import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { getChannelConfig } from '@/services/channel-config';

// Telegram parses these posts as HTML — a product name with `<`, `>` or `&`
// breaks parsing (HTTP 400, post silently dropped). Escape interpolated fields.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ANNOUNCED_KEY_PREFIX = 'promo:announced:';
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

export interface AutopostConfig {
  enabled: boolean;
  hours: number[];
  batchSize: number;
  // Which content types to publish. Promo on by default preserves the original
  // behaviour for configs saved before these flags existed.
  postPromo: boolean;
  postNew: boolean;
}

const AUTOPOST_DEFAULTS: AutopostConfig = {
  enabled: false,
  hours: [11],
  batchSize: 5,
  postPromo: true,
  postNew: false,
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

interface AutoPostResult {
  scanned: number;
  posted: number;
  skipped: number;
  errors: number;
}

export async function autoPostPromoToTelegram(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<AutoPostResult> {
  const config = await getChannelConfig('telegram');
  if (!config?.enabled || !config.botToken || !config.channelId) {
    return { scanned: 0, posted: 0, skipped: 0, errors: 0 };
  }

  const products = await prisma.product.findMany({
    // Only advertise in-stock products — posting an out-of-stock item also burns
    // its 30-day dedup key, so it can't be re-announced when restocked.
    where: { isActive: true, isPromo: true, quantity: { gt: 0 } },
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      priceRetail: true,
      imagePath: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: CANDIDATE_WINDOW, // scan a wide window; batchSize caps how many we post
  });

  let posted = 0;
  let skipped = 0;
  let errors = 0;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  for (const product of products) {
    if (posted >= batchSize) break;

    const cacheKey = `${ANNOUNCED_KEY_PREFIX}${product.id}`;
    const already = await redis.get(cacheKey).catch(() => null);
    if (already) {
      skipped++;
      continue;
    }

    const url = `${appUrl}/product/${product.slug}?utm_source=telegram&utm_medium=channel&utm_campaign=promo`;
    const text = `🔥 <b>Акція!</b>\n\n<b>${escapeHtml(product.name)}</b>\nКод: ${escapeHtml(product.code)}\nЦіна: <b>${Number(product.priceRetail).toFixed(2)} ₴</b>\n\n${url}`;

    const endpoint = product.imagePath ? 'sendPhoto' : 'sendMessage';
    const body = product.imagePath
      ? {
          chat_id: config.channelId,
          photo: `${appUrl}${product.imagePath}`,
          caption: text,
          parse_mode: 'HTML',
        }
      : {
          chat_id: config.channelId,
          text,
          parse_mode: 'HTML',
        };

    try {
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      if (!data.ok) {
        errors++;
        logger.error('promo-autopost: telegram error', {
          productId: product.id,
          error: data.description,
        });
        continue;
      }
      await redis.setex(cacheKey, ANNOUNCED_TTL_SECONDS, '1').catch(() => {});
      posted++;
    } catch (error) {
      errors++;
      logger.error('promo-autopost: fetch error', {
        productId: product.id,
        error: String(error),
      });
    }
  }

  return { scanned: products.length, posted, skipped, errors };
}

const NEW_ANNOUNCED_KEY_PREFIX = 'new:announced:';
// A product counts as a "new arrival" for this long after creation, so enabling
// the feature doesn't dump the whole catalog as "new".
const NEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Autopost recently-added products to the Telegram channel as "🆕 Новинка".
 * Excludes promo products (those go through autoPostPromoToTelegram, so a
 * product on sale isn't posted twice). Deduped 30 days via a separate redis key.
 */
export async function autoPostNewToTelegram(
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<AutoPostResult> {
  const config = await getChannelConfig('telegram');
  if (!config?.enabled || !config.botToken || !config.channelId) {
    return { scanned: 0, posted: 0, skipped: 0, errors: 0 };
  }

  const cutoff = new Date(Date.now() - NEW_WINDOW_MS);
  const products = await prisma.product.findMany({
    where: { isActive: true, isPromo: false, quantity: { gt: 0 }, createdAt: { gte: cutoff } },
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      priceRetail: true,
      imagePath: true,
    },
    orderBy: { createdAt: 'desc' },
    take: CANDIDATE_WINDOW, // scan a wide window; batchSize caps how many we post
  });

  let posted = 0;
  let skipped = 0;
  let errors = 0;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  for (const product of products) {
    if (posted >= batchSize) break;

    const cacheKey = `${NEW_ANNOUNCED_KEY_PREFIX}${product.id}`;
    const already = await redis.get(cacheKey).catch(() => null);
    if (already) {
      skipped++;
      continue;
    }

    const url = `${appUrl}/product/${product.slug}?utm_source=telegram&utm_medium=channel&utm_campaign=new_arrivals`;
    const text = `🆕 <b>Новинка!</b>\n\n<b>${escapeHtml(product.name)}</b>\nКод: ${escapeHtml(product.code)}\nЦіна: <b>${Number(product.priceRetail).toFixed(2)} ₴</b>\n\n${url}`;

    const endpoint = product.imagePath ? 'sendPhoto' : 'sendMessage';
    const body = product.imagePath
      ? {
          chat_id: config.channelId,
          photo: `${appUrl}${product.imagePath}`,
          caption: text,
          parse_mode: 'HTML',
        }
      : {
          chat_id: config.channelId,
          text,
          parse_mode: 'HTML',
        };

    try {
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      if (!data.ok) {
        errors++;
        logger.error('new-autopost: telegram error', {
          productId: product.id,
          error: data.description,
        });
        continue;
      }
      await redis.setex(cacheKey, ANNOUNCED_TTL_SECONDS, '1').catch(() => {});
      posted++;
    } catch (error) {
      errors++;
      logger.error('new-autopost: fetch error', {
        productId: product.id,
        error: String(error),
      });
    }
  }

  return { scanned: products.length, posted, skipped, errors };
}
