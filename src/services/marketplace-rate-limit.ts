// Distributed rate-limit tracker per marketplace, backed by Redis.
//
// Previously this was in-memory only — with multiple PM2 workers, each tracked
// its own slice and the admin dashboard showed only one process's view. Now we
// use a Redis sorted-set sliding window so all workers + cron containers share
// the same view, and the dashboard reflects real API pressure across the fleet.
//
// On Redis failure we silently fall back to per-process in-memory tracking —
// the dashboard reading becomes stale rather than the whole publish flow
// breaking.

import { redis } from '@/lib/redis';
import type { MarketplacePlatform } from '@/services/marketplace-health';
import { logger } from '@/lib/logger';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REDIS_TTL_SECONDS = 600; // keep the key for 10 min so it auto-expires when idle

// Published documentation suggests these per-hour limits; we display as
// "requests / 5 min" for tighter visibility.
const HOURLY_LIMITS: Record<MarketplacePlatform, number> = {
  olx: 6000, // OLX Partner API ≈ 100 req/min
  rozetka: 1000,
  prom: 1000,
  epicentrk: 1000,
};

const KEY = (platform: MarketplacePlatform) => `mp:ratelimit:${platform}`;

// In-memory fallback if Redis is unreachable.
const fallbackBuckets = new Map<MarketplacePlatform, number[]>();

function fallbackPrune(platform: MarketplacePlatform) {
  const arr = fallbackBuckets.get(platform);
  if (!arr) return;
  const cutoff = Date.now() - WINDOW_MS;
  while (arr.length && arr[0] < cutoff) arr.shift();
}

function fallbackRecord(platform: MarketplacePlatform) {
  let arr = fallbackBuckets.get(platform);
  if (!arr) {
    arr = [];
    fallbackBuckets.set(platform, arr);
  }
  arr.push(Date.now());
  fallbackPrune(platform);
}

function fallbackCount(platform: MarketplacePlatform): number {
  fallbackPrune(platform);
  return fallbackBuckets.get(platform)?.length || 0;
}

/**
 * Records one outbound API call. Fire-and-forget: errors never bubble up to
 * the caller (which is already mid-request to the marketplace).
 */
export function recordMarketplaceCall(platform: MarketplacePlatform): void {
  const now = Date.now();
  // Always write to in-memory too — keeps the fallback hot if Redis blips.
  fallbackRecord(platform);
  void (async () => {
    try {
      const key = KEY(platform);
      const cutoff = now - WINDOW_MS;
      // Sorted set with score = timestamp; member uniqueness needs the random suffix.
      await redis
        .multi()
        .zadd(key, now, `${now}-${Math.random().toString(36).slice(2, 8)}`)
        .zremrangebyscore(key, 0, cutoff)
        .expire(key, REDIS_TTL_SECONDS)
        .exec();
    } catch (err) {
      logger.warn('[marketplace-rate-limit] redis write failed, using in-memory fallback', {
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

export interface RateUsage {
  windowMs: number;
  count: number;
  limit5min: number;
  percent: number;
  warning: boolean;
}

async function distributedCount(platform: MarketplacePlatform): Promise<number> {
  const key = KEY(platform);
  const cutoff = Date.now() - WINDOW_MS;
  try {
    await redis.zremrangebyscore(key, 0, cutoff);
    return await redis.zcard(key);
  } catch (err) {
    logger.warn('[marketplace-rate-limit] redis read failed, using in-memory fallback', {
      platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackCount(platform);
  }
}

export async function getRateUsage(platform: MarketplacePlatform): Promise<RateUsage> {
  const count = await distributedCount(platform);
  const limit5min = Math.ceil(HOURLY_LIMITS[platform] / 12);
  const percent = limit5min > 0 ? Math.round((count / limit5min) * 100) : 0;
  return {
    windowMs: WINDOW_MS,
    count,
    limit5min,
    percent,
    warning: percent >= 80,
  };
}

export async function getAllRateUsage(): Promise<Record<MarketplacePlatform, RateUsage>> {
  const platforms = Object.keys(HOURLY_LIMITS) as MarketplacePlatform[];
  const usages = await Promise.all(platforms.map((p) => getRateUsage(p)));
  const out = {} as Record<MarketplacePlatform, RateUsage>;
  platforms.forEach((p, i) => {
    out[p] = usages[i];
  });
  return out;
}
