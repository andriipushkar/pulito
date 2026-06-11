import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { getChannelConfig } from '@/services/channel-config';
import { publishTextPost, publishPhotoPost } from '@/services/facebook';
import { publishImagePost } from '@/services/instagram';

// Telegram parses these posts as HTML — a product name with `<`, `>` or `&`
// breaks parsing (HTTP 400, post silently dropped). Escape interpolated fields.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type AutopostChannel = 'telegram' | 'facebook' | 'instagram';
export const AUTOPOST_CHANNELS: AutopostChannel[] = ['telegram', 'facebook', 'instagram'];

const ANNOUNCED_KEY_PREFIX = 'promo:announced:';
const NEW_ANNOUNCED_KEY_PREFIX = 'new:announced:';
const ANNOUNCED_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_BATCH_SIZE = 5;
// How many candidate products each run scans, decoupled from batchSize.
// batchSize caps how many we POST per run (the channel pace); this caps how
// many we LOOK AT. They must be independent: with a small batchSize, a window
// of batchSize*N would never reach products beyond the newest few, so freshly
// added items below that window would never get posted. A wide window lets the
// pace stay low (e.g. 2/run) while still eventually covering the whole 30-day
// set, since already-announced items are skipped via redis dedup.
const CANDIDATE_WINDOW = 200;
// A product counts as a "new arrival" for this long after creation, so enabling
// the feature doesn't dump the whole catalog as "new".
const NEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface AutopostConfig {
  enabled: boolean;
  hours: number[];
  batchSize: number;
  // Which content types to publish. Promo on by default preserves the original
  // behaviour for configs saved before these flags existed.
  postPromo: boolean;
  postNew: boolean;
  // Which channels to post to. Telegram-only by default — configs saved before
  // multi-channel support existed keep their original behaviour.
  channels: AutopostChannel[];
}

const AUTOPOST_DEFAULTS: AutopostConfig = {
  enabled: false,
  hours: [11],
  batchSize: 5,
  postPromo: true,
  postNew: false,
  channels: ['telegram'],
};

/**
 * Read the admin-configured autopost schedule (SiteSetting `telegram_autopost`).
 * The crontab runs hourly; this config — edited in /admin/bot-settings — decides
 * whether and at which Europe/Kyiv hours a run actually posts.
 */
export async function getAutopostConfig(): Promise<AutopostConfig> {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'telegram_autopost' } });
    if (!setting) return AUTOPOST_DEFAULTS;
    return { ...AUTOPOST_DEFAULTS, ...JSON.parse(setting.value) };
  } catch {
    return AUTOPOST_DEFAULTS;
  }
}

/** Current hour (0–23) in Europe/Kyiv — the timezone autopost hours are stored in. */
export function currentKyivHour(now: Date = new Date()): number {
  // Some ICU builds format midnight as "24" with hour12:false — normalise to 0.
  return (
    Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Europe/Kyiv',
      }).format(now),
    ) % 24
  );
}

export interface AutoPostResult {
  scanned: number;
  posted: number;
  skipped: number;
  errors: number;
  byChannel: Partial<Record<AutopostChannel, { posted: number; errors: number }>>;
}

interface AutopostProduct {
  id: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: unknown;
  imagePath: string | null;
}

type PostKind = 'promo' | 'new';

function productUrl(appUrl: string, p: AutopostProduct, channel: AutopostChannel, kind: PostKind) {
  const campaign = kind === 'promo' ? 'promo' : 'new_arrivals';
  return `${appUrl}/product/${p.slug}?utm_source=${channel}&utm_medium=channel&utm_campaign=${campaign}`;
}

// Telegram caption — HTML formatting.
function telegramText(p: AutopostProduct, url: string, kind: PostKind): string {
  const head = kind === 'promo' ? '🔥 <b>Акція!</b>' : '🆕 <b>Новинка!</b>';
  return `${head}\n\n<b>${escapeHtml(p.name)}</b>\nКод: ${escapeHtml(p.code)}\nЦіна: <b>${Number(p.priceRetail).toFixed(2)} ₴</b>\n\n${url}`;
}

// Facebook/Instagram caption — plain text (Graph API does not render HTML).
function plainText(p: AutopostProduct, url: string, kind: PostKind): string {
  const head = kind === 'promo' ? '🔥 Акція!' : '🆕 Новинка!';
  return `${head}\n\n${p.name}\nКод: ${p.code}\nЦіна: ${Number(p.priceRetail).toFixed(2)} ₴\n\n${url}`;
}

// Per-channel dedup keys. Telegram keeps the legacy un-suffixed keys so the
// existing 30-day history survives the multi-channel rollout (no re-posts).
function dedupKey(kind: PostKind, channel: AutopostChannel, productId: number): string {
  const prefix = kind === 'promo' ? ANNOUNCED_KEY_PREFIX : NEW_ANNOUNCED_KEY_PREFIX;
  const suffix = channel === 'telegram' ? '' : channel === 'facebook' ? 'fb:' : 'ig:';
  return `${prefix}${suffix}${productId}`;
}

/**
 * Posts one product to one channel. Returns:
 * - 'posted'  — sent successfully (caller sets the dedup key)
 * - 'skipped' — channel can't take this product (e.g. Instagram without image);
 *               dedup key is NOT set so it can post later (e.g. once a photo is added)
 * Throws on transport/API errors.
 */
async function sendToChannel(
  channel: AutopostChannel,
  p: AutopostProduct,
  appUrl: string,
  kind: PostKind,
  telegramCfg: { botToken: string; channelId: string } | null,
): Promise<'posted' | 'skipped'> {
  const url = productUrl(appUrl, p, channel, kind);

  if (channel === 'telegram') {
    if (!telegramCfg) return 'skipped';
    const text = telegramText(p, url, kind);
    const endpoint = p.imagePath ? 'sendPhoto' : 'sendMessage';
    const body = p.imagePath
      ? {
          chat_id: telegramCfg.channelId,
          photo: `${appUrl}${p.imagePath}`,
          caption: text,
          parse_mode: 'HTML',
        }
      : { chat_id: telegramCfg.channelId, text, parse_mode: 'HTML' };
    const res = await fetch(`https://api.telegram.org/bot${telegramCfg.botToken}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) throw new Error(data.description || 'telegram error');
    return 'posted';
  }

  if (channel === 'facebook') {
    const caption = plainText(p, url, kind);
    if (p.imagePath) await publishPhotoPost(`${appUrl}${p.imagePath}`, caption);
    else await publishTextPost(caption, url);
    return 'posted';
  }

  // instagram — image is mandatory for a feed post
  if (!p.imagePath) return 'skipped';
  await publishImagePost(`${appUrl}${p.imagePath}`, plainText(p, url, kind));
  return 'posted';
}

/** Channels from the requested list that are actually configured and enabled. */
async function resolveActiveChannels(requested: AutopostChannel[]): Promise<{
  channels: AutopostChannel[];
  telegramCfg: { botToken: string; channelId: string } | null;
}> {
  const active: AutopostChannel[] = [];
  let telegramCfg: { botToken: string; channelId: string } | null = null;

  for (const ch of requested) {
    if (ch === 'telegram') {
      const cfg = await getChannelConfig('telegram');
      if (cfg?.enabled && cfg.botToken && cfg.channelId) {
        telegramCfg = { botToken: cfg.botToken, channelId: cfg.channelId };
        active.push(ch);
      }
    } else if (ch === 'facebook') {
      const cfg = await getChannelConfig('facebook');
      if (cfg?.enabled && cfg.pageAccessToken && cfg.pageId) active.push(ch);
    } else if (ch === 'instagram') {
      const cfg = await getChannelConfig('instagram');
      if (cfg?.enabled && cfg.accessToken && cfg.businessAccountId) active.push(ch);
    }
  }
  return { channels: active, telegramCfg };
}

async function autoPost(
  kind: PostKind,
  batchSize: number,
  requestedChannels: AutopostChannel[],
): Promise<AutoPostResult> {
  const { channels, telegramCfg } = await resolveActiveChannels(requestedChannels);
  if (channels.length === 0) {
    return { scanned: 0, posted: 0, skipped: 0, errors: 0, byChannel: {} };
  }

  const products = (await prisma.product.findMany({
    // Only advertise in-stock products — posting an out-of-stock item also burns
    // its 30-day dedup key, so it can't be re-announced when restocked.
    where:
      kind === 'promo'
        ? { isActive: true, isPromo: true, quantity: { gt: 0 } }
        : {
            isActive: true,
            // Excludes promo products (those go through the promo kind, so a
            // product on sale isn't posted twice).
            isPromo: false,
            quantity: { gt: 0 },
            createdAt: { gte: new Date(Date.now() - NEW_WINDOW_MS) },
          },
    select: { id: true, name: true, slug: true, code: true, priceRetail: true, imagePath: true },
    orderBy: kind === 'promo' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
    take: CANDIDATE_WINDOW, // scan a wide window; batchSize caps how many we post
  })) as AutopostProduct[];

  let posted = 0; // products with ≥1 successful channel post — what batchSize caps
  let skipped = 0;
  let errors = 0;
  const byChannel: AutoPostResult['byChannel'] = {};
  for (const ch of channels) byChannel[ch] = { posted: 0, errors: 0 };

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  for (const product of products) {
    if (posted >= batchSize) break;

    let postedSomewhere = false;
    let pendingAnywhere = false;

    for (const channel of channels) {
      const cacheKey = dedupKey(kind, channel, product.id);
      const already = await redis.get(cacheKey).catch(() => null);
      if (already) continue;
      pendingAnywhere = true;

      try {
        const outcome = await sendToChannel(channel, product, appUrl, kind, telegramCfg);
        if (outcome === 'posted') {
          await redis.setex(cacheKey, ANNOUNCED_TTL_SECONDS, '1').catch(() => {});
          byChannel[channel]!.posted++;
          postedSomewhere = true;
        }
        // 'skipped' (e.g. IG without image): no dedup key, retried on later runs
      } catch (error) {
        errors++;
        byChannel[channel]!.errors++;
        logger.error(`${kind}-autopost: ${channel} error`, {
          productId: product.id,
          error: String(error),
        });
      }
    }

    if (postedSomewhere) posted++;
    else if (!pendingAnywhere) skipped++; // already announced on every requested channel
  }

  return { scanned: products.length, posted, skipped, errors, byChannel };
}

/** Autopost promo products ("🔥 Акція") to the given channels. */
export async function autoPostPromo(
  batchSize = DEFAULT_BATCH_SIZE,
  channels: AutopostChannel[] = ['telegram'],
): Promise<AutoPostResult> {
  return autoPost('promo', batchSize, channels);
}

/**
 * Autopost recently-added products ("🆕 Новинка") to the given channels.
 * Deduped 30 days per channel via redis keys.
 */
export async function autoPostNew(
  batchSize = DEFAULT_BATCH_SIZE,
  channels: AutopostChannel[] = ['telegram'],
): Promise<AutoPostResult> {
  return autoPost('new', batchSize, channels);
}

// Backward-compatible Telegram-only wrappers (older call sites and tests).
export async function autoPostPromoToTelegram(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<AutoPostResult> {
  return autoPost('promo', batchSize, ['telegram']);
}

export async function autoPostNewToTelegram(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<AutoPostResult> {
  return autoPost('new', batchSize, ['telegram']);
}
