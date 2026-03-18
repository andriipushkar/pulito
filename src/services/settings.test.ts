import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: { findMany: vi.fn() },
  },
}));

vi.mock('@/services/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { LONG: 3600 },
}));

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { getSettings, invalidateSettingsCache } from './settings';

const mockPrisma = prisma as unknown as {
  siteSetting: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe('getSettings', () => {
  it('returns all settings as key-value map', async () => {
    mockPrisma.siteSetting.findMany.mockResolvedValue([
      { key: 'site_name', value: 'Порошок' },
      { key: 'site_phone', value: '+380501234567' },
    ]);
    const result = await getSettings();
    expect(result.site_name).toBe('Порошок');
    expect(result.site_phone).toBe('+380501234567');
  });
});

describe('invalidateSettingsCache', () => {
  it('does not throw', async () => {
    await expect(invalidateSettingsCache()).resolves.toBeUndefined();
  });
});
