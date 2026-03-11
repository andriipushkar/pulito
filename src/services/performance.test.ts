import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import { recordMetric, getAggregatedMetrics, aggregateDailyMetrics } from './performance';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    performanceMetric: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    zadd: vi.fn(),
    expire: vi.fn(),
    keys: vi.fn(),
    zrangebyscore: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
const mockPrisma = prisma as unknown as MockPrismaClient;
const mockRedis = redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordMetric', () => {
  it('should store metric in Redis sorted set', async () => {
    await recordMetric({ route: '/product', metric: 'LCP', value: 2500 });
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      expect.stringContaining('perf:'),
      2500,
      expect.any(String),
    );
    expect(mockRedis.expire).toHaveBeenCalled();
  });
});

describe('getAggregatedMetrics', () => {
  it('should query metrics from prisma', async () => {
    mockPrisma.performanceMetric.findMany.mockResolvedValue([]);
    const result = await getAggregatedMetrics('2024-01-01', '2024-01-31');
    expect(result).toEqual([]);
    expect(mockPrisma.performanceMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      }),
    );
  });

  it('should filter by route when provided', async () => {
    mockPrisma.performanceMetric.findMany.mockResolvedValue([]);
    await getAggregatedMetrics('2024-01-01', '2024-01-31', '/product');
    expect(mockPrisma.performanceMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ route: '/product' }),
      }),
    );
  });
});

describe('aggregateDailyMetrics', () => {
  it('should aggregate metrics from Redis and store in DB', async () => {
    mockRedis.keys.mockResolvedValue(['perf:2024-01-15:/product:LCP']);
    mockRedis.zrangebyscore.mockResolvedValue([
      'member1', '1000',
      'member2', '2000',
      'member3', '3000',
    ]);

    await aggregateDailyMetrics('2024-01-15');

    expect(mockPrisma.performanceMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date_route_metric: expect.objectContaining({
            route: '/product',
            metric: 'LCP',
          }),
        }),
        create: expect.objectContaining({
          sampleCount: 3,
        }),
      }),
    );
  });

  it('should skip keys with no values', async () => {
    mockRedis.keys.mockResolvedValue(['perf:2024-01-15:/empty:CLS']);
    mockRedis.zrangebyscore.mockResolvedValue([]);

    await aggregateDailyMetrics('2024-01-15');

    expect(mockPrisma.performanceMetric.upsert).not.toHaveBeenCalled();
  });

  it('should handle no keys', async () => {
    mockRedis.keys.mockResolvedValue([]);
    await aggregateDailyMetrics('2024-01-15');
    expect(mockPrisma.performanceMetric.upsert).not.toHaveBeenCalled();
  });

  it('should skip keys with fewer than 3 parts', async () => {
    mockRedis.keys.mockResolvedValue(['perf:2024-01-15:badkey']);
    // After removing prefix: "2024-01-15:badkey" -> split by : gives ["2024-01-15","badkey"] = 2 parts < 3
    await aggregateDailyMetrics('2024-01-15');
    expect(mockPrisma.performanceMetric.upsert).not.toHaveBeenCalled();
  });

  it('should handle route with colons correctly', async () => {
    // key = perf:2024-01-15:/product:detail:LCP -> route = "/product:detail", metric = "LCP"
    mockRedis.keys.mockResolvedValue(['perf:2024-01-15:/product:detail:LCP']);
    mockRedis.zrangebyscore.mockResolvedValue(['m1', '500', 'm2', '1000']);

    await aggregateDailyMetrics('2024-01-15');

    expect(mockPrisma.performanceMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date_route_metric: expect.objectContaining({
            route: '/product:detail',
            metric: 'LCP',
          }),
        }),
      }),
    );
  });

  it('should handle single value (percentile edge case)', async () => {
    mockRedis.keys.mockResolvedValue(['perf:2024-01-15:/single:LCP']);
    // Single value - all percentiles should be the same
    mockRedis.zrangebyscore.mockResolvedValue(['m1', '500']);

    await aggregateDailyMetrics('2024-01-15');

    expect(mockPrisma.performanceMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sampleCount: 1,
          p50: 500,
          p75: 500,
          p90: 500,
        }),
      }),
    );
  });

  it('should calculate correct percentile values', async () => {
    mockRedis.keys.mockResolvedValue(['perf:2024-01-15:/home:FCP']);
    // 10 values: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000
    const members: string[] = [];
    for (let i = 1; i <= 10; i++) {
      members.push(`m${i}`, String(i * 100));
    }
    mockRedis.zrangebyscore.mockResolvedValue(members);

    await aggregateDailyMetrics('2024-01-15');

    expect(mockPrisma.performanceMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sampleCount: 10,
          p50: 500,
          p75: 800,
          p90: 900,
        }),
      }),
    );
  });
});
