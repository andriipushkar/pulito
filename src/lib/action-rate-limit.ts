import { headers } from 'next/headers';
import { checkRateLimit, type RateLimitResult } from '@/services/rate-limit';

interface ActionRateLimitConfig {
  prefix: string;
  max: number;
  windowSec: number;
}

/** Rate limit presets for Server Actions */
export const ACTION_LIMITS = {
  /** Checkout: 5 per minute (prevent order spam) */
  checkout: { prefix: 'rl:action:checkout:', max: 5, windowSec: 60 } satisfies ActionRateLimitConfig,
  /** Cart mutations: 30 per minute */
  cart: { prefix: 'rl:action:cart:', max: 30, windowSec: 60 } satisfies ActionRateLimitConfig,
  /** Reviews: 5 per 15 minutes */
  review: { prefix: 'rl:action:review:', max: 5, windowSec: 900 } satisfies ActionRateLimitConfig,
};

/**
 * Check rate limit inside a Server Action.
 * Server Actions bypass Next.js middleware, so we must check manually.
 * Returns null if allowed, or an error message if blocked.
 */
export async function checkActionRateLimit(
  config: ActionRateLimitConfig
): Promise<string | null> {
  const headerStore = await headers();
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    'unknown';

  let result: RateLimitResult;
  try {
    result = await checkRateLimit(ip, config);
  } catch {
    // If Redis is down, allow the request rather than blocking all users
    return null;
  }

  if (!result.allowed) {
    return 'Забагато запитів. Спробуйте пізніше.';
  }

  return null;
}
