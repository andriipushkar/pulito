import { redis } from '@/lib/redis';

const LOGIN_PREFIX = 'rl:login:';
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 900; // 15 minutes in seconds

export class RateLimitError extends Error {
  constructor(
    message: string,
    public statusCode: number = 429,
    public retryAfter?: number
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
  try {
    const key = `${LOGIN_PREFIX}${ip}:${email.toLowerCase()}`;
    const current = await redis.get(key);

    if (current && Number(current) >= MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      throw new RateLimitError(
        `Забагато спроб входу. Спробуйте через ${Math.ceil(ttl / 60)} хвилин.`,
        429,
        ttl > 0 ? ttl : BLOCK_DURATION
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
  config: RateLimitConfig
): Promise<RateLimitResult> {
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
          }
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
