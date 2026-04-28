import { redis } from '@/lib/redis';

/**
 * Instagram Graph API enforces a hard ceiling of 25 published posts per
 * 24-hour rolling window per Business account. Exceeding it returns a 4 9001
 * error, which costs us a publish attempt + risks the access token getting
 * temporarily restricted, so we guard locally before calling the API.
 */
export const INSTAGRAM_DAILY_LIMIT = 25;

const KEY_PREFIX = 'ig:posts:';
// Keys auto-expire after 25h so we never carry stale counts across days.
const KEY_TTL_SECONDS = 60 * 60 * 25;

function todayKey(): string {
  return `${KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

export async function getInstagramQuota(): Promise<QuotaStatus> {
  let used = 0;
  try {
    const raw = await redis.get(todayKey());
    used = raw ? Number(raw) : 0;
    if (!Number.isFinite(used) || used < 0) used = 0;
  } catch {
    // Fail open — if Redis is down, do not block legitimate posts.
    return {
      used: 0,
      limit: INSTAGRAM_DAILY_LIMIT,
      remaining: INSTAGRAM_DAILY_LIMIT,
      exhausted: false,
    };
  }

  return {
    used,
    limit: INSTAGRAM_DAILY_LIMIT,
    remaining: Math.max(0, INSTAGRAM_DAILY_LIMIT - used),
    exhausted: used >= INSTAGRAM_DAILY_LIMIT,
  };
}

/**
 * Increment today's published-post counter. Should be called *after* the
 * Instagram API confirms a successful publish, not before, so failed attempts
 * do not consume quota.
 */
export async function consumeInstagramQuota(): Promise<void> {
  const key = todayKey();
  try {
    const next = await redis.incr(key);
    if (next === 1) {
      await redis.expire(key, KEY_TTL_SECONDS);
    }
  } catch {
    // best-effort; never block a successful publish
  }
}

/**
 * Throw an InstagramError-compatible result if today's quota is exhausted.
 * Designed to be called at the top of each publishImage/Carousel/Reels helper.
 */
export async function assertInstagramQuotaAvailable(): Promise<void> {
  const status = await getInstagramQuota();
  if (status.exhausted) {
    const err = new Error(
      `Instagram daily publish quota exhausted (${status.used}/${status.limit}). Спробуйте завтра.`,
    ) as Error & { statusCode?: number };
    err.statusCode = 429;
    err.name = 'InstagramQuotaExceededError';
    throw err;
  }
}
