import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRefreshLock } from './auth-refresh-lock';

describe('withRefreshLock', () => {
  beforeEach(() => {
    // Default: simulate no navigator.locks support
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs fn directly when navigator.locks is unavailable', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const out = await withRefreshLock(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(out).toBe('result');
  });

  it('runs fn directly server-side (no navigator)', async () => {
    vi.stubGlobal('navigator', undefined);
    const fn = vi.fn().mockResolvedValue(42);
    const out = await withRefreshLock(fn);
    expect(out).toBe(42);
  });

  it('uses navigator.locks.request when available', async () => {
    const request = vi.fn(async (_name: string, _opts: unknown, cb: () => Promise<unknown>) => {
      return cb();
    });
    vi.stubGlobal('navigator', { locks: { request } });

    const fn = vi.fn().mockResolvedValue('locked');
    const out = await withRefreshLock(fn);

    expect(request).toHaveBeenCalledWith(
      'pulito-auth-refresh',
      { mode: 'exclusive' },
      expect.any(Function),
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(out).toBe('locked');
  });

  it('serialises concurrent callers (queue semantics)', async () => {
    // Real-ish lock simulation: hold one promise, queue the rest.
    let active = 0;
    let maxActive = 0;
    const queue: Array<() => void> = [];
    let busy = false;

    const request = async (_n: string, _o: unknown, cb: () => Promise<unknown>) => {
      if (busy) {
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      busy = true;
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        return await cb();
      } finally {
        active--;
        busy = false;
        queue.shift()?.();
      }
    };
    vi.stubGlobal('navigator', { locks: { request } });

    const fn = async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    };

    await Promise.all([withRefreshLock(fn), withRefreshLock(fn), withRefreshLock(fn)]);
    expect(maxActive).toBe(1); // never more than 1 in flight
  });
});
