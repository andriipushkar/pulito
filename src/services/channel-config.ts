import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  channelId: string;
  managerChatId?: string;
}

export interface ViberConfig {
  enabled: boolean;
  authToken: string;
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

export type ChannelType = 'telegram' | 'viber' | 'facebook' | 'instagram' | 'tiktok' | 'olx' | 'rozetka' | 'prom' | 'epicentrk';

type ChannelConfigMap = {
  telegram: TelegramConfig;
  viber: ViberConfig;
  facebook: FacebookConfig;
  instagram: InstagramConfig;
  tiktok: TikTokConfig;
  olx: MarketplaceConfig;
  rozetka: MarketplaceConfig;
  prom: MarketplaceConfig;
  epicentrk: MarketplaceConfig;
};

const DB_KEY_PREFIX = 'channel_';

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
    case 'viber': {
      const authToken = process.env.VIBER_AUTH_TOKEN;
      if (!authToken) return null;
      return { enabled: true, authToken };
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
  channel: T
): Promise<ChannelConfigMap[T] | null> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: `${DB_KEY_PREFIX}${channel}` },
    });

    if (setting?.value) {
      const config = JSON.parse(setting.value) as ChannelConfigMap[T];
      if (config.enabled) return config;
    }
  } catch {
    // DB read failed — fall through to env
  }

  return getEnvFallback(channel) as ChannelConfigMap[T] | null;
}

export async function getAllChannelConfigs(): Promise<Record<ChannelType, ChannelConfigMap[ChannelType] | null>> {
  const channels: ChannelType[] = ['telegram', 'viber', 'facebook', 'instagram', 'tiktok', 'olx', 'rozetka', 'prom', 'epicentrk'];
  const result = {} as Record<ChannelType, ChannelConfigMap[ChannelType] | null>;

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: channels.map((c) => `${DB_KEY_PREFIX}${c}`) } },
  });

  const settingsMap = new Map(settings.map((s) => [s.key.replace(DB_KEY_PREFIX, ''), s.value]));

  for (const channel of channels) {
    const raw = settingsMap.get(channel);
    if (raw) {
      try {
        result[channel] = JSON.parse(raw);
        continue;
      } catch { /* fall through */ }
    }
    result[channel] = getEnvFallback(channel);
  }

  return result;
}

function maskToken(token: string): string {
  if (!token || token.length <= 4) return '****';
  return '•'.repeat(Math.min(token.length - 4, 20)) + token.slice(-4);
}

export function maskChannelConfig(
  channel: ChannelType,
  config: ChannelConfigMap[ChannelType] | null
): Record<string, unknown> | null {
  if (!config) return null;

  switch (channel) {
    case 'telegram': {
      const c = config as TelegramConfig;
      return { ...c, botToken: maskToken(c.botToken), channelId: c.channelId, managerChatId: c.managerChatId };
    }
    case 'viber': {
      const c = config as ViberConfig;
      return { ...c, authToken: maskToken(c.authToken) };
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
    default:
      return null;
  }
}

export async function saveChannelConfig(
  channel: ChannelType,
  config: ChannelConfigMap[ChannelType],
  userId?: number
): Promise<void> {
  const key = `${DB_KEY_PREFIX}${channel}`;
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(config), updatedBy: userId ?? null },
    update: { value: JSON.stringify(config), updatedBy: userId ?? null },
  });
}

export async function testChannelConnection(
  channel: ChannelType,
  config: ChannelConfigMap[ChannelType]
): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    switch (channel) {
      case 'telegram': {
        const c = config as TelegramConfig;
        const res = await fetch(`https://api.telegram.org/bot${c.botToken}/getMe`, { signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        if (!data.ok) return { success: false, error: data.description || 'Невірний токен бота' };
        // Also check channel access
        const chatRes = await fetch(`https://api.telegram.org/bot${c.botToken}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.channelId }),
          signal: AbortSignal.timeout(10000),
        });
        const chatData = await chatRes.json();
        if (!chatData.ok) return { success: false, error: `Бот: @${data.result.username}. Канал не знайдено: ${chatData.description}` };
        return { success: true, name: `@${data.result.username} → ${chatData.result.title}` };
      }
      case 'viber': {
        const c = config as ViberConfig;
        const res = await fetch('https://chatapi.viber.com/pa/get_account_info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Viber-Auth-Token': c.authToken },
          body: '{}',
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        if (data.status !== 0) return { success: false, error: data.status_message || 'Невірний токен' };
        return { success: true, name: data.name || 'Viber Bot' };
      }
      case 'facebook': {
        const c = config as FacebookConfig;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${c.pageId}?fields=name,fan_count&access_token=${c.pageAccessToken}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const data = await res.json();
        if (data.error) return { success: false, error: data.error.message };
        return { success: true, name: data.name };
      }
      case 'instagram': {
        const c = config as InstagramConfig;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${c.businessAccountId}?fields=username,followers_count&access_token=${c.accessToken}`,
          { signal: AbortSignal.timeout(10000) }
        );
        const data = await res.json();
        if (data.error) return { success: false, error: data.error.message };
        return { success: true, name: `@${data.username}` };
      }
      case 'tiktok': {
        const c = config as TikTokConfig;
        const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count', {
          headers: { Authorization: `Bearer ${c.accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        if (data.error?.code) return { success: false, error: data.error.message || 'Невірний токен' };
        return { success: true, name: data.data?.user?.display_name || 'TikTok' };
      }
      default:
        return { success: false, error: 'Невідомий канал' };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Помилка з\'єднання' };
  }
}
