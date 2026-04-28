import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getChannelConfig } from '@/services/channel-config';
import { autoPostPromoToTelegram } from './promo-autopost';

const mockFindMany = vi.mocked(prisma.product.findMany);
const mockGet = vi.mocked(redis.get);
const mockSetex = vi.mocked(redis.setex);
const mockGetConfig = vi.mocked(getChannelConfig);
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockSetex.mockResolvedValue('OK' as never);
});

describe('autoPostPromoToTelegram', () => {
  it('returns zero when channel is not configured', async () => {
    mockGetConfig.mockResolvedValue({ enabled: false } as never);

    const result = await autoPostPromoToTelegram();
    expect(result).toEqual({ scanned: 0, posted: 0, skipped: 0, errors: 0 });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('posts new promo products and skips already-announced ones', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      botToken: 'tok',
      channelId: '@chan',
    } as never);
    mockFindMany.mockResolvedValue([
      {
        id: 1,
        name: 'New',
        slug: 'new',
        code: 'NEW1',
        priceRetail: 100,
        imagePath: null,
      },
      {
        id: 2,
        name: 'Old',
        slug: 'old',
        code: 'OLD1',
        priceRetail: 200,
        imagePath: '/img.jpg',
      },
    ] as never);
    mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce('1'); // 2nd is announced

    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true, result: { message_id: 99 } }),
    });

    const result = await autoPostPromoToTelegram(5);

    expect(result.posted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockSetex).toHaveBeenCalledWith('promo:announced:1', expect.any(Number), '1');
  });

  it('records errors when telegram API rejects', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      botToken: 'tok',
      channelId: '@chan',
    } as never);
    mockFindMany.mockResolvedValue([
      { id: 3, name: 'X', slug: 'x', code: 'X', priceRetail: 1, imagePath: null },
    ] as never);
    mockGet.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: false, description: 'chat not found' }),
    });

    const result = await autoPostPromoToTelegram();
    expect(result.posted).toBe(0);
    expect(result.errors).toBe(1);
    expect(mockSetex).not.toHaveBeenCalled();
  });

  it('respects batchSize cap', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      botToken: 'tok',
      channelId: '@chan',
    } as never);
    mockFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `P${i}`,
        slug: `p${i}`,
        code: `P${i}`,
        priceRetail: 1,
        imagePath: null,
      })) as never,
    );
    mockGet.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });

    const result = await autoPostPromoToTelegram(2);
    expect(result.posted).toBe(2);
  });
});
