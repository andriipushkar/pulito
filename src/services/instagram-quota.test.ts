import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  },
}));

import { redis } from '@/lib/redis';
import {
  getInstagramQuota,
  consumeInstagramQuota,
  assertInstagramQuotaAvailable,
  INSTAGRAM_DAILY_LIMIT,
} from './instagram-quota';

const mockGet = vi.mocked(redis.get);
const mockIncr = vi.mocked(redis.incr);
const mockExpire = vi.mocked(redis.expire);

beforeEach(() => {
  vi.clearAllMocks();
  mockExpire.mockResolvedValue(1 as never);
});

describe('getInstagramQuota', () => {
  it('returns full quota when key is unset', async () => {
    mockGet.mockResolvedValue(null);
    const status = await getInstagramQuota();
    expect(status).toEqual({
      used: 0,
      limit: INSTAGRAM_DAILY_LIMIT,
      remaining: INSTAGRAM_DAILY_LIMIT,
      exhausted: false,
    });
  });

  it('returns remaining when partially used', async () => {
    mockGet.mockResolvedValue('10');
    const status = await getInstagramQuota();
    expect(status.used).toBe(10);
    expect(status.remaining).toBe(INSTAGRAM_DAILY_LIMIT - 10);
    expect(status.exhausted).toBe(false);
  });

  it('flags exhausted when at the limit', async () => {
    mockGet.mockResolvedValue(String(INSTAGRAM_DAILY_LIMIT));
    const status = await getInstagramQuota();
    expect(status.exhausted).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('fails open when redis throws', async () => {
    mockGet.mockRejectedValue(new Error('redis down'));
    const status = await getInstagramQuota();
    expect(status.exhausted).toBe(false);
    expect(status.remaining).toBe(INSTAGRAM_DAILY_LIMIT);
  });

  it('treats negative or NaN counters as zero', async () => {
    mockGet.mockResolvedValue('not-a-number');
    const status = await getInstagramQuota();
    expect(status.used).toBe(0);
  });
});

describe('consumeInstagramQuota', () => {
  it('increments and sets TTL on first hit', async () => {
    mockIncr.mockResolvedValue(1);
    await consumeInstagramQuota();
    expect(mockIncr).toHaveBeenCalledTimes(1);
    expect(mockExpire).toHaveBeenCalledTimes(1);
  });

  it('does not reset TTL on subsequent hits', async () => {
    mockIncr.mockResolvedValue(7);
    await consumeInstagramQuota();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('swallows redis failures', async () => {
    mockIncr.mockRejectedValue(new Error('boom'));
    await expect(consumeInstagramQuota()).resolves.toBeUndefined();
  });
});

describe('assertInstagramQuotaAvailable', () => {
  it('passes when quota remains', async () => {
    mockGet.mockResolvedValue('1');
    await expect(assertInstagramQuotaAvailable()).resolves.toBeUndefined();
  });

  it('throws when exhausted', async () => {
    mockGet.mockResolvedValue(String(INSTAGRAM_DAILY_LIMIT));
    await expect(assertInstagramQuotaAvailable()).rejects.toThrow(
      /Instagram daily publish quota exhausted/,
    );
  });
});
