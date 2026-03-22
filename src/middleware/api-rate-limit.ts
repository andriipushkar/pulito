import { getRouteLimit } from './rate-limit-config';

/**
 * Per-route rate limiter using in-memory sliding window.
 *
 * Note: Next.js middleware runs in Edge Runtime which cannot use ioredis.
 * This uses in-memory counters per instance. For multi-instance deployments,
 * use Cloudflare Rate Limiting or nginx limit_req as primary.
 */

const ipRouteCounts = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup threshold
const MAX_ENTRIES = 50_000;

function cleanup() {
  if (ipRouteCounts.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of ipRouteCounts) {
    if (now >= v.resetAt) ipRouteCounts.delete(k);
  }
}

export async function checkApiRateLimit(
  pathname: string,
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = getRouteLimit(pathname);
  const now = Date.now();
  const key = `${ip}:${pathname.split('/').slice(0, 5).join('/')}`;

  const entry = ipRouteCounts.get(key);

  if (!entry || now >= entry.resetAt) {
    ipRouteCounts.set(key, { count: 1, resetAt: now + limit.window * 1000 });
    cleanup();
    return { allowed: true, remaining: limit.max - 1 };
  }

  entry.count++;

  const allowed = entry.count <= limit.max;
  const remaining = Math.max(0, limit.max - entry.count);

  return { allowed, remaining };
}
