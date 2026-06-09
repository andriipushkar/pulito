import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
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
import { getChannelConfig, getAllChannelConfigs, saveChannelConfig } from './channel-config';
import { encrypt, isEncrypted } from '@/lib/encryption';

const mockPrisma = prisma as unknown as {
  siteSetting: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
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
    expect(configs).toHaveProperty('olx');
  });

  it('decrypts encrypted marketplace secrets on read', async () => {
    const encryptedKey = encrypt('rzk-secret');
    mockPrisma.siteSetting.findMany.mockResolvedValue([
      { key: 'channel_rozetka', value: JSON.stringify({ enabled: true, apiKey: encryptedKey }) },
    ]);
    const configs = await getAllChannelConfigs();
    expect(configs.rozetka).toMatchObject({ enabled: true, apiKey: 'rzk-secret' });
  });
});

describe('encryption at rest', () => {
  it('decrypts encrypted token on read', async () => {
    const encrypted = encrypt('secret-access-token');
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, accessToken: encrypted, clientId: 'cid' }),
    });
    const config = await getChannelConfig('olx');
    expect(config?.accessToken).toBe('secret-access-token');
  });

  it('auto-migrates legacy plaintext to encrypted form on read', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, apiKey: 'plain-key' }),
    });
    const config = await getChannelConfig('rozetka');
    expect(config?.apiKey).toBe('plain-key');
    expect(mockPrisma.siteSetting.update).toHaveBeenCalledTimes(1);
    const writeCall = mockPrisma.siteSetting.update.mock.calls[0][0];
    const stored = JSON.parse(writeCall.data.value) as { apiKey: string };
    expect(isEncrypted(stored.apiKey)).toBe(true);
  });

  it('encrypts sensitive fields on save (no existing row)', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    mockPrisma.siteSetting.upsert.mockResolvedValue({});
    await saveChannelConfig('prom', { enabled: true, apiToken: 'tok-123' });
    expect(mockPrisma.siteSetting.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.siteSetting.upsert.mock.calls[0][0];
    const stored = JSON.parse(call.create.value) as { apiToken: string; enabled: boolean };
    expect(isEncrypted(stored.apiToken)).toBe(true);
    expect(stored.enabled).toBe(true);
  });

  it('encrypts merged fields when existing marketplace row present', async () => {
    const existingEncrypted = encrypt('old-secret');
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, apiKey: existingEncrypted, sellerId: 'old' }),
    });
    mockPrisma.siteSetting.update.mockResolvedValue({});
    await saveChannelConfig('rozetka', { enabled: true, sellerId: 'new' });
    expect(mockPrisma.siteSetting.update).toHaveBeenCalledTimes(1);
    const call = mockPrisma.siteSetting.update.mock.calls[0][0];
    const stored = JSON.parse(call.data.value) as { apiKey: string; sellerId: string };
    expect(isEncrypted(stored.apiKey)).toBe(true);
    expect(stored.sellerId).toBe('new');
  });

  it('leaves non-sensitive fields untouched on save', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);
    mockPrisma.siteSetting.upsert.mockResolvedValue({});
    await saveChannelConfig('olx', {
      enabled: true,
      clientId: 'public-client-id',
      accessToken: 'secret-token',
    });
    const call = mockPrisma.siteSetting.upsert.mock.calls[0][0];
    const stored = JSON.parse(call.create.value) as { clientId: string; accessToken: string };
    expect(stored.clientId).toBe('public-client-id');
    expect(isEncrypted(stored.accessToken)).toBe(true);
  });

  it('does NOT wipe existing sensitive field when payload contains empty string', async () => {
    // Regression: admin clicked into the masked apiKey field and cleared it
    // without typing a new value. The empty string used to overwrite the
    // stored credential during merge. After the fix, empty sensitive fields
    // are dropped and the existing token survives.
    const existingEncrypted = encrypt('secret-key-keep-me');
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, apiKey: existingEncrypted, sellerId: 'old' }),
    });
    mockPrisma.siteSetting.update.mockResolvedValue({});

    await saveChannelConfig('rozetka', {
      enabled: true,
      apiKey: '',
      sellerId: 'new',
    });

    const call = mockPrisma.siteSetting.update.mock.calls[0][0];
    const stored = JSON.parse(call.data.value) as { apiKey: string; sellerId: string };
    expect(stored.sellerId).toBe('new');
    expect(isEncrypted(stored.apiKey)).toBe(true);
    // apiKey must still decrypt to the original value, not empty.
    const { decrypt } = await import('@/lib/encryption');
    expect(decrypt(stored.apiKey)).toBe('secret-key-keep-me');
  });

  it('does overwrite sensitive field when admin types a new non-empty value', async () => {
    const existingEncrypted = encrypt('old-key');
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, apiKey: existingEncrypted }),
    });
    mockPrisma.siteSetting.update.mockResolvedValue({});

    await saveChannelConfig('rozetka', { enabled: true, apiKey: 'brand-new-key' });

    const call = mockPrisma.siteSetting.update.mock.calls[0][0];
    const stored = JSON.parse(call.data.value) as { apiKey: string };
    const { decrypt } = await import('@/lib/encryption');
    expect(decrypt(stored.apiKey)).toBe('brand-new-key');
  });
});
