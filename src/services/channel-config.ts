import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { decrypt, encrypt, isEncrypted } from '@/lib/encryption';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  channelId: string;
  managerChatId?: string;
}

export interface FacebookConfig {
  enabled: boolean;
  pageAccessToken: string;
  pageId: string;
}

export interface InstagramConfig {
  enabled: boolean;
  accessToken: string;
  businessAccountId: string;
  appId?: string;
  appSecret?: string;
}

export interface TikTokConfig {
  enabled: boolean;
  accessToken: string;
  openId: string;
}

export interface MarketplaceConfig {
  enabled: boolean;
  [key: string]: string | boolean | undefined;
}

export type ChannelType =
  | 'telegram'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'olx'
  | 'rozetka'
  | 'prom'
  | 'epicentrk';

type ChannelConfigMap = {
  telegram: TelegramConfig;
  facebook: FacebookConfig;
  instagram: InstagramConfig;
  tiktok: TikTokConfig;
  olx: MarketplaceConfig;
  rozetka: MarketplaceConfig;
  prom: MarketplaceConfig;
  epicentrk: MarketplaceConfig;
};

const DB_KEY_PREFIX = 'channel_';

// Field names whose values are credentials and must be encrypted at rest.
// Matched across all channel types — covers marketplace + social tokens.
const SENSITIVE_FIELDS = new Set([
  'apiKey',
  'apiSecret',
  'apiToken',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'password',
  'botToken',
  'authToken',
  'pageAccessToken',
  'appSecret',
]);

function transformSensitiveValues(
  obj: Record<string, unknown>,
  transform: (value: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.length > 0 && SENSITIVE_FIELDS.has(k)) {
      out[k] = transform(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  return transformSensitiveValues(config, (v) => (isEncrypted(v) ? v : encrypt(v)));
}

function decryptConfig(config: Record<string, unknown>): {
  value: Record<string, unknown>;
  hadPlaintext: boolean;
} {
  let hadPlaintext = false;
  const out = transformSensitiveValues(config, (v) => {
    if (isEncrypted(v)) {
      try {
        return decrypt(v);
      } catch {
        return v;
      }
    }
    hadPlaintext = true;
    return v;
  });
  return { value: out, hadPlaintext };
}

function getEnvFallback(channel: ChannelType): ChannelConfigMap[typeof channel] | null {
  switch (channel) {
    case 'telegram': {
      const botToken = env.TELEGRAM_BOT_TOKEN;
      const channelId = env.TELEGRAM_CHANNEL_ID;
      if (!botToken || !channelId) return null;
      return {
        enabled: true,
        botToken,
        channelId,
        managerChatId: env.TELEGRAM_MANAGER_CHAT_ID || undefined,
      };
    }
    case 'facebook': {
      const pageAccessToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const pageId = env.FACEBOOK_PAGE_ID;
      if (!pageAccessToken || !pageId) return null;
      return { enabled: true, pageAccessToken, pageId };
    }
    case 'instagram': {
      const accessToken = env.INSTAGRAM_ACCESS_TOKEN;
      const businessAccountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
      if (!accessToken || !businessAccountId) return null;
      return {
        enabled: true,
        accessToken,
        businessAccountId,
        appId: env.INSTAGRAM_APP_ID || undefined,
        appSecret: env.INSTAGRAM_APP_SECRET || undefined,
      };
    }
    case 'tiktok':
    case 'olx':
    case 'rozetka':
    case 'prom':
    case 'epicentrk':
      return null; // No env fallback for these
    default:
      return null;
  }
}

export async function getChannelConfig<T extends ChannelType>(
  channel: T,
): Promise<ChannelConfigMap[T] | null> {
  try {
    const key = `${DB_KEY_PREFIX}${channel}`;
    const setting = await prisma.siteSetting.findUnique({ where: { key } });

    if (setting?.value) {
      const raw = JSON.parse(setting.value) as Record<string, unknown>;
      const { value: decrypted, hadPlaintext } = decryptConfig(raw);
      // Auto-migrate legacy plaintext secrets to encrypted form.
      if (hadPlaintext) {
        try {
          const reEncrypted = encryptConfig(decrypted);
          await prisma.siteSetting.update({
            where: { key },
            data: { value: JSON.stringify(reEncrypted) },
          });
        } catch {
          // Best-effort migration — do not block read on failure
        }
      }
      const config = decrypted as ChannelConfigMap[T];
      if (config.enabled) return config;
    }
  } catch {
    // DB read failed — fall through to env
  }

  return getEnvFallback(channel) as ChannelConfigMap[T] | null;
}

/**
 * Resolve live Telegram credentials, DB-first (admin panel → `channel_telegram`),
 * falling back to env per-field. The order-notification bot and the customer-
 * facing webhook bot both go through this instead of reading `process.env`
 * directly — otherwise a token set in the admin UI would never be used.
 *
 * Unlike `getChannelConfig('telegram')` this does NOT gate on the `enabled`
 * flag and does NOT require `channelId`: order notifications must work even
 * when there is no marketing channel and the channel toggle is off.
 */
export async function getTelegramCreds(): Promise<{
  botToken: string;
  managerChatId: string;
  channelId: string;
}> {
  let cfg: Partial<TelegramConfig> | null = null;
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'channel_telegram' } });
    if (setting?.value) {
      const raw = JSON.parse(setting.value) as Record<string, unknown>;
      cfg = decryptConfig(raw).value as unknown as Partial<TelegramConfig>;
    }
  } catch {
    // DB down or unparseable value — fall back to env per-field below.
  }
  // Env fallback reads live process.env (matching the bot's historical
  // behaviour) so a runtime change is picked up without a parsed-config reload.
  return {
    botToken: cfg?.botToken || process.env.TELEGRAM_BOT_TOKEN || '',
    managerChatId: cfg?.managerChatId || process.env.TELEGRAM_MANAGER_CHAT_ID || '',
    channelId: cfg?.channelId || process.env.TELEGRAM_CHANNEL_ID || '',
  };
}

/**
 * Resolve the live Instagram credentials, DB-first (so a refreshed token is
 * picked up), falling back to env per-field. All Instagram API calls and the
 * token-refresh job go through this instead of reading env directly — otherwise
 * a refreshed long-lived token would never be used and would age out at day 60.
 */
export async function getInstagramCreds(): Promise<{
  accessToken: string;
  businessAccountId: string;
  tokenExpiresAt?: string;
}> {
  const cfg = (await getChannelConfig('instagram')) as
    | (InstagramConfig & { tokenExpiresAt?: string })
    | null;
  return {
    accessToken: cfg?.accessToken || env.INSTAGRAM_ACCESS_TOKEN || '',
    businessAccountId: cfg?.businessAccountId || env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    tokenExpiresAt: cfg?.tokenExpiresAt,
  };
}

/**
 * Resolve the live Facebook page credentials, DB-first (so a page configured
 * only via the admin panel works), falling back to env per-field. Facebook
 * publishing must go through this — reading env directly broke admin-only
 * setups the same way payments did.
 */
export async function getFacebookCreds(): Promise<{
  pageId: string;
  pageAccessToken: string;
}> {
  const cfg = (await getChannelConfig('facebook')) as FacebookConfig | null;
  return {
    pageId: cfg?.pageId || env.FACEBOOK_PAGE_ID || '',
    pageAccessToken: cfg?.pageAccessToken || env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
  };
}

/**
 * Persist a refreshed Instagram long-lived token (merged into the existing
 * channel_instagram config, so businessAccountId etc. are preserved).
 */
export async function saveRefreshedInstagramToken(
  accessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const businessAccountId =
    (await getInstagramCreds()).businessAccountId || env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';
  const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  await saveChannelConfig('instagram', {
    enabled: true,
    accessToken,
    businessAccountId,
    tokenExpiresAt,
  });
}

export async function getAllChannelConfigs(): Promise<
  Record<ChannelType, ChannelConfigMap[ChannelType] | null>
> {
  const channels: ChannelType[] = [
    'telegram',
    'facebook',
    'instagram',
    'tiktok',
    'olx',
    'rozetka',
    'prom',
    'epicentrk',
  ];
  const result = {} as Record<ChannelType, ChannelConfigMap[ChannelType] | null>;

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: channels.map((c) => `${DB_KEY_PREFIX}${c}`) } },
  });

  const settingsMap = new Map(settings.map((s) => [s.key.replace(DB_KEY_PREFIX, ''), s.value]));

  for (const channel of channels) {
    const raw = settingsMap.get(channel);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const { value: decrypted } = decryptConfig(parsed);
        result[channel] = decrypted as ChannelConfigMap[ChannelType];
        continue;
      } catch {
        /* fall through */
      }
    }
    result[channel] = getEnvFallback(channel);
  }

  return result;
}

function maskToken(token: string): string {
  if (!token || token.length <= 4) return '****';
  return '•'.repeat(Math.min(token.length - 4, 20)) + token.slice(-4);
}

const MARKETPLACE_SENSITIVE_FIELDS = new Set([
  'apiKey',
  'apiSecret',
  'apiToken',
  'accessToken',
  'clientSecret',
  'refreshToken',
  'password',
]);

function maskMarketplaceConfig(config: MarketplaceConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && MARKETPLACE_SENSITIVE_FIELDS.has(key)) {
      result[key] = maskToken(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function maskChannelConfig(
  channel: ChannelType,
  config: ChannelConfigMap[ChannelType] | null,
): Record<string, unknown> | null {
  if (!config) return null;

  switch (channel) {
    case 'telegram': {
      const c = config as TelegramConfig;
      return {
        ...c,
        botToken: maskToken(c.botToken),
        channelId: c.channelId,
        managerChatId: c.managerChatId,
      };
    }
    case 'facebook': {
      const c = config as FacebookConfig;
      return { ...c, pageAccessToken: maskToken(c.pageAccessToken), pageId: c.pageId };
    }
    case 'instagram': {
      const c = config as InstagramConfig;
      return {
        ...c,
        accessToken: maskToken(c.accessToken),
        appSecret: c.appSecret ? maskToken(c.appSecret) : undefined,
      };
    }
    case 'tiktok': {
      const c = config as TikTokConfig;
      return { ...c, accessToken: maskToken(c.accessToken) };
    }
    case 'olx':
    case 'rozetka':
    case 'prom':
    case 'epicentrk':
      return maskMarketplaceConfig(config as MarketplaceConfig);
    default:
      return null;
  }
}

export async function saveChannelConfig(
  channel: ChannelType,
  config: ChannelConfigMap[ChannelType],
  userId?: number,
): Promise<void> {
  const key = `${DB_KEY_PREFIX}${channel}`;

  // ALL channels merge with existing — the admin form strips masked secret values
  // (route deletes bullet-masked fields), so a save that changes only a non-secret
  // field (e.g. Facebook pageId) would otherwise wipe the stored token. This applies
  // to social channels (telegram/facebook/instagram) as well as marketplaces.
  // Existing values are decrypted before merge, then re-encrypted at rest.
  {
    const existing = await prisma.siteSetting.findUnique({ where: { key } });
    if (existing?.value) {
      try {
        const existingConfig = JSON.parse(existing.value) as Record<string, unknown>;
        const { value: existingDecrypted } = decryptConfig(existingConfig);
        // Defence-in-depth: drop empty-string sensitive fields from the incoming
        // payload before merge. This prevents accidental credential wipes when the
        // admin clicks into a masked field and clears it without typing a replacement.
        const sanitized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
          if (SENSITIVE_FIELDS.has(k) && typeof v === 'string' && v.trim() === '') continue;
          sanitized[k] = v;
        }
        const merged = { ...existingDecrypted, ...sanitized };
        await prisma.siteSetting.update({
          where: { key },
          data: { value: JSON.stringify(encryptConfig(merged)), updatedBy: userId ?? null },
        });
        return;
      } catch {
        // Corrupted existing JSON — fall through to replace
      }
    }
  }

  const encrypted = encryptConfig(config as Record<string, unknown>);
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(encrypted), updatedBy: userId ?? null },
    update: { value: JSON.stringify(encrypted), updatedBy: userId ?? null },
  });
}

export async function testChannelConnection(
  channel: ChannelType,
  config: ChannelConfigMap[ChannelType],
): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    switch (channel) {
      case 'telegram': {
        const c = config as TelegramConfig;
        const res = await fetch(`https://api.telegram.org/bot${c.botToken}/getMe`, {
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        if (!data.ok) return { success: false, error: data.description || 'Невірний токен бота' };
        // No marketing channel configured — the store uses the bot only for
        // manager notifications, so a valid token is the whole success check.
        if (!c.channelId) {
          return { success: true, name: `@${data.result.username}` };
        }
        // Also check channel access
        const chatRes = await fetch(`https://api.telegram.org/bot${c.botToken}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.channelId }),
          signal: AbortSignal.timeout(10000),
        });
        const chatData = await chatRes.json();
        if (!chatData.ok)
          return {
            success: false,
            error: `Бот: @${data.result.username}. Канал не знайдено: ${chatData.description}`,
          };
        return { success: true, name: `@${data.result.username} → ${chatData.result.title}` };
      }
      case 'facebook': {
        const c = config as FacebookConfig;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${c.pageId}?fields=name,fan_count&access_token=${c.pageAccessToken}`,
          { signal: AbortSignal.timeout(10000) },
        );
        const data = await res.json();
        if (data.error) return { success: false, error: data.error.message };
        return { success: true, name: data.name };
      }
      case 'instagram': {
        const c = config as InstagramConfig;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${c.businessAccountId}?fields=username,followers_count&access_token=${c.accessToken}`,
          { signal: AbortSignal.timeout(10000) },
        );
        const data = await res.json();
        if (data.error) return { success: false, error: data.error.message };
        return { success: true, name: `@${data.username}` };
      }
      case 'tiktok': {
        const c = config as TikTokConfig;
        const res = await fetch(
          'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count',
          {
            headers: { Authorization: `Bearer ${c.accessToken}` },
            signal: AbortSignal.timeout(10000),
          },
        );
        const data = await res.json();
        if (data.error?.code)
          return { success: false, error: data.error.message || 'Невірний токен' };
        return { success: true, name: data.data?.user?.display_name || 'TikTok' };
      }
      case 'olx': {
        const c = config as MarketplaceConfig;
        const token = typeof c.accessToken === 'string' ? c.accessToken : '';
        if (!token) return { success: false, error: 'Не вказано Access Token' };
        const res = await fetch('https://www.olx.ua/api/partner/users/me', {
          headers: { Authorization: `Bearer ${token}`, Version: '2.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, error: data.error?.message || `HTTP ${res.status}` };
        }
        const data = await res.json();
        return { success: true, name: data.data?.name || data.name || 'OLX акаунт' };
      }
      case 'rozetka': {
        const c = config as MarketplaceConfig;
        const apiKey = typeof c.apiKey === 'string' ? c.apiKey : '';
        if (!apiKey) return { success: false, error: 'Не вказано API Key' };
        // Rozetka auth: PUT /sites with username+password (both = apiKey for token auth)
        const res = await fetch('https://api-seller.rozetka.com.ua/sites', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: apiKey, password: apiKey }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.content?.token) {
          return { success: false, error: data.errors?.[0]?.message || `HTTP ${res.status}` };
        }
        return { success: true, name: `Rozetka Seller${c.sellerId ? ` #${c.sellerId}` : ''}` };
      }
      case 'prom': {
        const c = config as MarketplaceConfig;
        const token = typeof c.apiToken === 'string' ? c.apiToken : '';
        if (!token) return { success: false, error: 'Не вказано API Token' };
        const res = await fetch('https://my.prom.ua/api/v1/products/list?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, error: data.message || data.error || `HTTP ${res.status}` };
        }
        return { success: true, name: 'Prom.ua магазин' };
      }
      case 'epicentrk': {
        const c = config as MarketplaceConfig;
        const apiKey = typeof c.apiKey === 'string' ? c.apiKey : '';
        if (!apiKey) return { success: false, error: 'Не вказано API Key' };
        const res = await fetch('https://marketplace.epicentrk.ua/api/v1/products?limit=1', {
          headers: { 'X-Api-Key': apiKey },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return {
            success: false,
            error: data.error?.message || data.message || `HTTP ${res.status}`,
          };
        }
        return { success: true, name: `Epicentr K${c.sellerId ? ` #${c.sellerId}` : ''}` };
      }
      default:
        return { success: false, error: 'Невідомий канал' };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Помилка з'єднання" };
  }
}
