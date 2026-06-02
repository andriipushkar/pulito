import { redis } from './redis';

/**
 * Best-effort mutual exclusion for cron jobs that must not overlap (e.g.
 * marketplace price/stock/order syncs). Uses Redis SET NX EX as the lock
 * primitive and DEL on release. The TTL guarantees the lock auto-expires
 * if the holding process crashes.
 *
 * Usage:
 *   const ok = await withCronLock('sync-marketplace-prices', 1800, async () => {
 *     // long-running work
 *   });
 *   if (!ok.acquired) console.log('previous run still in flight');
 */
export interface CronLockResult<T> {
  acquired: boolean;
  result?: T;
}

const LOCK_PREFIX = 'cron:lock:';

export async function withCronLock<T>(
  name: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<CronLockResult<T>> {
  const key = `${LOCK_PREFIX}${name}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let acquired = false;
  try {
    const ok = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
    acquired = ok === 'OK';
  } catch (err) {
    // Fail CLOSED: if Redis is unreachable we can't guarantee mutual exclusion,
    // so skip this run rather than risk two unsynchronized executions
    // double-processing a non-idempotent job. The next scheduled tick retries
    // once Redis recovers. (Previously this ran the job unlocked.)
    console.error(`[CronLock:${name}] Redis SET failed, skipping run to avoid double-exec:`, err);
    return { acquired: false };
  }

  if (!acquired) return { acquired: false };

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    try {
      // Only delete if we still own the lock (avoid releasing a renewed lock).
      const current = await redis.get(key);
      if (current === token) await redis.del(key);
    } catch (err) {
      console.error(`[CronLock:${name}] Redis release failed:`, err);
    }
  }
}
