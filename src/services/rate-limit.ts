import { redis } from '@/lib/redis';

const LOGIN_PREFIX = 'rl:login:';
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 900; // 15 minutes in seconds

export class RateLimitError extends Error {
  constructor(
    message: string,
    public statusCode: number = 429,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Check and increment login attempts for IP+email combination.
 * Throws RateLimitError if blocked.
 */
export async function checkLoginRateLimit(ip: string, email: string): Promise<void> {
  if (process.env.DISABLE_RATE_LIMIT === '1') return;
  try {
    const key = `${LOGIN_PREFIX}${ip}:${email.toLowerCase()}`;
    const current = await redis.get(key);

    if (current && Number(current) >= MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      throw new RateLimitError(
        `Забагато спроб входу. Спробуйте через ${Math.ceil(ttl / 60)} хвилин.`,
        429,
        ttl > 0 ? ttl : BLOCK_DURATION,
      );
    }
  } catch (error) {
    // Re-throw rate limit errors, but swallow Redis connection failures
    if (error instanceof RateLimitError) throw error;
    // Redis down — allow request (JWT validation still protects against invalid credentials)
  }
}

/**
 * Record a failed login attempt.
 */
export async function recordFailedLogin(ip: string, email: string): Promise<void> {
  if (process.env.DISABLE_RATE_LIMIT === '1') return;
  try {
    const key = `${LOGIN_PREFIX}${ip}:${email.toLowerCase()}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, BLOCK_DURATION);
    }
  } catch {
    // Redis down — skip recording (non-critical)
  }
}

/**
 * Clear login attempts on successful login.
 */
export async function clearLoginAttempts(ip: string, email: string): Promise<void> {
  const key = `${LOGIN_PREFIX}${ip}:${email.toLowerCase()}`;
  await redis.del(key);
}

// --- General-purpose API rate limiter (sliding window) ---

interface RateLimitConfig {
  /** Redis key prefix */
  prefix: string;
  /** Maximum requests allowed */
  max: number;
  /** Window size in seconds */
  windowSec: number;
}

/** Predefined rate limit presets */
export const RATE_LIMITS = {
  /** Auth endpoints: 10 requests per minute */
  auth: { prefix: 'rl:auth:', max: 10, windowSec: 60 } satisfies RateLimitConfig,
  /** Public API: 60 requests per minute */
  api: { prefix: 'rl:api:', max: 60, windowSec: 60 } satisfies RateLimitConfig,
  /** Sensitive operations (password reset, etc.): 3 per 15 min */
  sensitive: { prefix: 'rl:sens:', max: 3, windowSec: 900 } satisfies RateLimitConfig,
  /** Product search: 30 requests per minute */
  search: { prefix: 'rl:search:', max: 30, windowSec: 60 } satisfies RateLimitConfig,
  /** Instant search (autocomplete): 60 requests per minute */
  instantSearch: { prefix: 'rl:isearch:', max: 60, windowSec: 60 } satisfies RateLimitConfig,
  /** Cart operations: 30 requests per minute */
  cart: { prefix: 'rl:cart:', max: 30, windowSec: 60 } satisfies RateLimitConfig,
  /** Order operations: 10 requests per minute */
  orders: { prefix: 'rl:orders:', max: 10, windowSec: 60 } satisfies RateLimitConfig,
  /** Admin panel: 60 requests per minute */
  admin: { prefix: 'rl:admin:', max: 60, windowSec: 60 } satisfies RateLimitConfig,
  /** Cron jobs: 5 requests per minute */
  cron: { prefix: 'rl:cron:', max: 5, windowSec: 60 } satisfies RateLimitConfig,
  /** Reviews: 5 per 15 minutes */
  reviews: { prefix: 'rl:reviews:', max: 5, windowSec: 900 } satisfies RateLimitConfig,
  /** Wholesale: 10 per minute */
  wholesale: { prefix: 'rl:wholesale:', max: 10, windowSec: 60 } satisfies RateLimitConfig,
  /** Subscriptions: 10 per minute */
  subscriptions: { prefix: 'rl:subs:', max: 10, windowSec: 60 } satisfies RateLimitConfig,
  /** Blog/content: 60 per minute */
  content: { prefix: 'rl:content:', max: 60, windowSec: 60 } satisfies RateLimitConfig,
  /** Admin exports (heavy joins, large payloads): 10 per minute per admin */
  adminExport: { prefix: 'rl:adminexport:', max: 10, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * AI content generation (Claude/Gemini calls — each costs cents).
   * Per-user, not per-IP, because admins share office IPs. Hard cap of
   * 60/hour stops a stuck UI button (or a malicious tab loop) from running
   * up an unbilled OpenAI/Anthropic bill while the operator sleeps.
   */
  adminAiGenerate: { prefix: 'rl:adminai:', max: 60, windowSec: 3600 } satisfies RateLimitConfig,
  /**
   * Payment-provider credential test (LiqPay/Mono/WayForPay verification
   * pings). 5/min per admin: enough for legit "I just pasted a new key"
   * flow, low enough that a stolen session can't probe credentials at
   * scale to confirm validity before exfiltration.
   */
  adminPaymentTest: { prefix: 'rl:paymtest:', max: 5, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * Public delivery-lookup endpoints (cities, streets, warehouses, estimate,
   * ukrposhta-cities). Used by the checkout autocomplete — typical user
   * makes ≤10 queries in a flow, so 30/min covers a normal session and
   * blocks autocomplete-spam DoS against Nova Poshta upstream.
   */
  publicDelivery: { prefix: 'rl:pubdeliv:', max: 30, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * 1C integration endpoints (key-authenticated import/export). 1C nightly
   * sync sends batches of products/prices/stock/orders — 100/min covers
   * full-catalog runs while still capping an abusive (stolen) key.
   */
  integration1c: { prefix: 'rl:int1c:', max: 100, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * Per-admin PDF generation daily cap. PDF rendering pulls a full
   * analytics report into Chromium + writes to disk — orders of magnitude
   * heavier than the average API call. The minute-bucket `adminExport`
   * cap (10/min) still applies on top; this 50/day ceiling stops a stolen
   * session from looping the endpoint overnight and exhausting disk.
   */
  adminPdfExport: { prefix: 'rl:pdf:', max: 50, windowSec: 86400 } satisfies RateLimitConfig,
  /**
   * Public coupon validation. A real customer tries ≤3 codes per checkout
   * (paste, mistype, retry). 20 / 5min gives them generous headroom while
   * blocking brute-force enumeration of valid codes (the keyspace for
   * `PROMO[0-9]{3}`-shaped codes is small enough to crack at full throttle).
   */
  couponValidate: { prefix: 'rl:coupon:', max: 20, windowSec: 300 } satisfies RateLimitConfig,
  /**
   * Bulk SEO regeneration. A single call touches up to 100 ProductContent
   * rows + ~200 template SELECTs (pre-fix it was N+1). 5/hour per admin is
   * generous for the legit "I changed the global template, refresh
   * everything" workflow while stopping a stuck UI button / stolen session
   * from looping the endpoint as a DB-load DoS.
   */
  adminSeoBulk: { prefix: 'rl:seobulk:', max: 5, windowSec: 3600 } satisfies RateLimitConfig,
  /**
   * Public XML/RSS feeds (/feed.xml, /feed/google-shopping, /hotline.xml,
   * /blog/feed.xml). Aggregators (Google Merchant, Hotline) poll every
   * 30 min from rotating IPs, so 60/min per IP gives them headroom while
   * stopping bot-scrapers from looping the heavy queries (5k product JOIN
   * each call). Behind Cloudflare in production — this is L7 defense.
   */
  publicFeed: { prefix: 'rl:feed:', max: 60, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * 404 beacon (`/api/v1/log-404`). Honest browser fires it once per real
   * 404. A bot can flood unique paths to inflate `not_found_log` until the
   * admin viewer becomes useless. 30/min per IP covers a user clicking
   * through many broken legacy URLs while capping abuse — Redis cost is
   * cheaper than a runaway Postgres upsert.
   */
  publicLog404: { prefix: 'rl:log404:', max: 30, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * Stock-count barcode scanner. A physical scanner emits 1 event per scan,
   * a fast operator does ≤3/sec. 120/min per (admin, count) absorbs that
   * pace while blocking a stuck wedge scanner (or an attacker holding the
   * trigger) from blasting thousands of phantom scans into one inventory.
   */
  adminScan: { prefix: 'rl:scan:', max: 120, windowSec: 60 } satisfies RateLimitConfig,
  /**
   * Bulk import (CSV/XLSX/YML for products/prices/images + preview). Each
   * call parses up to 10MB + does N upserts; 5/hour per admin covers the
   * legit "re-upload after fixing typos" workflow while stopping a stuck
   * UI button or stolen session from looping the endpoint.
   */
  adminImport: { prefix: 'rl:import:', max: 5, windowSec: 3600 } satisfies RateLimitConfig,

  /**
   * Supplier feed sync / preview. Each call triggers an OUTBOUND fetch of the
   * supplier URL (up to 50MB / 60s) + parse, so it's heavier than a file upload
   * and could be abused to hammer a supplier or pin a worker. 20/hour per admin
   * covers manual "sync now" + iterating on a feed mapping during setup.
   */
  adminSupplierSync: { prefix: 'rl:supsync:', max: 20, windowSec: 3600 } satisfies RateLimitConfig,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/**
 * Sliding-window rate limiter using Redis.
 * Returns whether the request is allowed and headers info.
 */
export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (process.env.DISABLE_RATE_LIMIT === '1') {
    return { allowed: true, remaining: config.max, retryAfter: 0 };
  }
  let results;
  const key = `${config.prefix}${ip}`;
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  try {
    // Use a Redis pipeline for atomicity
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, now - windowMs);
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
    pipeline.zcard(key);
    pipeline.expire(key, config.windowSec);
    results = await pipeline.exec();
  } catch {
    // Redis down — allow request (graceful degradation)
    return { allowed: true, remaining: config.max, retryAfter: 0 };
  }

  const count = (results?.[2]?.[1] as number) || 0;
  const allowed = count <= config.max;
  const remaining = Math.max(0, config.max - count);

  // Estimate retry-after: TTL of the oldest entry in window
  let retryAfter = 0;
  if (!allowed) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    if (oldest.length >= 2) {
      const oldestTime = Number(oldest[1]);
      retryAfter = Math.ceil((oldestTime + windowMs - now) / 1000);
    }
    retryAfter = Math.max(1, retryAfter);
  }

  return { allowed, remaining, retryAfter };
}

/**
 * Higher-order function to wrap API route handlers with rate limiting.
 * Returns 429 if limit exceeded, otherwise calls the handler.
 */
export function withRateLimit(config: RateLimitConfig) {
  return (handler: (request: Request) => Promise<Response>) => {
    return async (request: Request): Promise<Response> => {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

      const result = await checkRateLimit(ip, config);

      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Забагато запитів. Спробуйте пізніше.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(result.retryAfter),
              'X-RateLimit-Limit': String(config.max),
              'X-RateLimit-Remaining': '0',
            },
          },
        );
      }

      const response = await handler(request);

      // Add rate limit headers to successful responses
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', String(config.max));
      headers.set('X-RateLimit-Remaining', String(result.remaining));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
  };
}
