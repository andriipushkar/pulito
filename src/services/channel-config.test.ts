import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_CHANNEL_ID: '@test',
    TELEGRAM_MANAGER_CHAT_ID: '123',
    FACEBOOK_PAGE_ACCESS_TOKEN: '',
    FACEBOOK_PAGE_ID: '',
    INSTAGRAM_ACCESS_TOKEN: '',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: '',
    INSTAGRAM_APP_ID: '',
    INSTAGRAM_APP_SECRET: '',
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

import { prisma } from '@/lib/prisma';
import { getChannelConfig, getAllChannelConfigs } from './channel-config';

const mockPrisma = prisma as unknown as {
  siteSetting: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe('getChannelConfig', () => {
  it('returns config from DB when available', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, botToken: 'db-token', channelId: '@db' }),
    });
    const config = await getChannelConfig('telegram');
    expect(config).toMatchObject({ enabled: true, botToken: 'db-token' });
  });

  it('falls back to env when DB has no config', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    const config = await getChannelConfig('telegram');
    expect(config).toMatchObject({ enabled: true, botToken: 'test-bot-token' });
  });

  it('returns null for unconfigured channel', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    const config = await getChannelConfig('tiktok');
    expect(config).toBeNull();
  });
});

describe('getAllChannelConfigs', () => {
  it('returns configs for all channels', async () => {
    mockPrisma.siteSetting.findMany.mockResolvedValue([]);
    const configs = await getAllChannelConfigs();
    expect(configs).toHaveProperty('telegram');
    expect(configs).toHaveProperty('viber');
    expect(configs).toHaveProperty('olx');
  });
});
