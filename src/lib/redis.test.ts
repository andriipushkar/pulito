import { describe, it, expect, vi, beforeEach } from 'vitest';

let retryStrategyFn: ((times: number) => number) | undefined;

const mockRedisInstance = {
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  status: 'ready',
};

vi.mock('ioredis', () => {
  return {
    default: class Redis {
      constructor(_url: string, opts?: { retryStrategy?: (times: number) => number }) {
        if (opts?.retryStrategy) {
          retryStrategyFn = opts.retryStrategy;
        }
        return mockRedisInstance;
      }
    },
  };
});

describe('redis', () => {
  beforeEach(() => {
    vi.resetModules();
    const g = globalThis as unknown as { redis: unknown };
    delete g.redis;
    retryStrategyFn = undefined;
  });

  it('should export redis instance', async () => {
    const { redis } = await import('./redis');
    expect(redis).toBeDefined();
  });

  it('should export CACHE_TTL constants', async () => {
    const { CACHE_TTL } = await import('./redis');
    expect(CACHE_TTL.SHORT).toBe(60);
    expect(CACHE_TTL.MEDIUM).toBe(300);
    expect(CACHE_TTL.LONG).toBe(3600);
    expect(CACHE_TTL.DAY).toBe(86400);
  });

  it('should create redis instance from ioredis', async () => {
    const { redis } = await import('./redis');
    expect(redis).toBe(mockRedisInstance);
  });

  it('should cache redis on globalThis in non-production', async () => {
    const { redis } = await import('./redis');
    const g = globalThis as unknown as { redis: unknown };
    expect(g.redis).toBe(redis);
  });

  it('should reuse cached instance on subsequent imports', async () => {
    const { redis: first } = await import('./redis');
    vi.resetModules();
    const { redis: second } = await import('./redis');
    expect(second).toBe(first);
  });

  it('retryStrategy returns delay capped at 2000ms', async () => {
    await import('./redis');
    expect(retryStrategyFn).toBeDefined();
    // times=1 → min(50, 2000) = 50
    expect(retryStrategyFn!(1)).toBe(50);
    // times=10 → min(500, 2000) = 500
    expect(retryStrategyFn!(10)).toBe(500);
    // times=100 → min(5000, 2000) = 2000
    expect(retryStrategyFn!(100)).toBe(2000);
  });

  it('should not cache on globalThis in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { redis } = await import('./redis');
      expect(redis).toBeDefined();
      const g = globalThis as unknown as { redis: unknown };
      // In production, globalForRedis.redis should NOT be set by the module
      // (it was deleted in beforeEach, and the production branch skips caching)
      expect(g.redis).toBeUndefined();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
