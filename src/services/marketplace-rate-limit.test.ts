import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis, mockMulti } = vi.hoisted(() => {
  const mockMulti = {
    zadd: vi.fn().mockReturnThis(),
    zremrangebyscore: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  const mockRedis = {
    multi: vi.fn(() => mockMulti),
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
  };
  return { mockRedis, mockMulti };
});

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

import { recordMarketplaceCall, getRateUsage, getAllRateUsage } from './marketplace-rate-limit';

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.zremrangebyscore.mockResolvedValue(0);
  mockRedis.zcard.mockResolvedValue(0);
  mockMulti.exec.mockResolvedValue([]);
});

describe('marketplace-rate-limit (Redis-backed)', () => {
  it('records a call in Redis via zadd + zremrangebyscore + expire', async () => {
    recordMarketplaceCall('rozetka');
    // fire-and-forget — wait a microtask tick for the promise chain
    await new Promise((r) => setImmediate(r));

    expect(mockRedis.multi).toHaveBeenCalled();
    expect(mockMulti.zadd).toHaveBeenCalledWith(
      'mp:ratelimit:rozetka',
      expect.any(Number),
      expect.stringMatching(/^\d+-[a-z0-9]+$/),
    );
    expect(mockMulti.expire).toHaveBeenCalledWith('mp:ratelimit:rozetka', 600);
  });

  it('reads count from Redis zcard', async () => {
    mockRedis.zcard.mockResolvedValue(42);
    const usage = await getRateUsage('rozetka');
    expect(mockRedis.zcard).toHaveBeenCalledWith('mp:ratelimit:rozetka');
    expect(usage.count).toBe(42);
  });

  it('computes percent and warning correctly', async () => {
    // rozetka limit is 1000/hour → ~84 per 5min
    mockRedis.zcard.mockResolvedValue(80);
    const usage = await getRateUsage('rozetka');
    expect(usage.limit5min).toBe(84);
    expect(usage.percent).toBeGreaterThan(0);
    expect(usage.warning).toBe(true); // 80/84 ≈ 95%
  });

  it('falls back to in-memory when Redis read fails', async () => {
    mockRedis.zcard.mockRejectedValue(new Error('redis down'));
    // First record locally so the fallback has data
    mockMulti.exec.mockRejectedValue(new Error('redis down'));
    recordMarketplaceCall('olx');
    await new Promise((r) => setImmediate(r));

    const usage = await getRateUsage('olx');
    expect(usage.count).toBeGreaterThanOrEqual(1);
  });

  it('returns usage for all 4 platforms via getAllRateUsage', async () => {
    mockRedis.zcard.mockResolvedValue(10);
    const all = await getAllRateUsage();
    expect(Object.keys(all).sort()).toEqual(['epicentrk', 'olx', 'prom', 'rozetka']);
    expect(all.olx.count).toBe(10);
  });
});
