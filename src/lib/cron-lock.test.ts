import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('./redis', () => ({ redis: mockRedis }));

import { withCronLock } from './cron-lock';

beforeEach(() => vi.clearAllMocks());

describe('withCronLock', () => {
  it('runs fn when lock acquired', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    const fn = vi.fn().mockResolvedValue('done');
    const r = await withCronLock('test', 60, fn);
    expect(r.acquired).toBe(true);
    expect(r.result).toBe('done');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('skips fn when lock not acquired', async () => {
    mockRedis.set.mockResolvedValue(null);
    const fn = vi.fn();
    const r = await withCronLock('test', 60, fn);
    expect(r.acquired).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('releases lock after success', async () => {
    let storedToken = '';
    mockRedis.set.mockImplementation((_k: string, v: string) => {
      storedToken = v;
      return Promise.resolve('OK');
    });
    mockRedis.get.mockImplementation(() => Promise.resolve(storedToken));
    mockRedis.del.mockResolvedValue(1);

    await withCronLock('test', 60, async () => 'ok');
    expect(mockRedis.del).toHaveBeenCalledTimes(1);
  });

  it('releases lock after exception', async () => {
    let storedToken = '';
    mockRedis.set.mockImplementation((_k: string, v: string) => {
      storedToken = v;
      return Promise.resolve('OK');
    });
    mockRedis.get.mockImplementation(() => Promise.resolve(storedToken));
    mockRedis.del.mockResolvedValue(1);

    await expect(
      withCronLock('test', 60, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(mockRedis.del).toHaveBeenCalledTimes(1);
  });

  it('does not delete lock when token differs (lock was renewed by another)', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue('different-token');
    await withCronLock('test', 60, async () => 'ok');
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('fails closed when Redis errors (skips run to avoid double-exec)', async () => {
    // Redis unreachable → mutual exclusion can't be guaranteed, so the run is
    // skipped rather than executed unlocked (would risk double-processing a
    // non-idempotent job). Next scheduled tick retries once Redis recovers.
    mockRedis.set.mockRejectedValue(new Error('redis down'));
    const fn = vi.fn().mockResolvedValue('still-ran');
    const r = await withCronLock('test', 60, fn);
    expect(r.acquired).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
