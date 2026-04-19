import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, type RateLimitResult } from '@/services/rate-limit';

interface RateLimitConfig {
  prefix: string;
  max: number;
  windowSec: number;
}

// Accepts Next.js 16 route handler shapes and auth-wrapped handlers that carry
// an optional `{ params }` segment data object. Uses `any` for the context so
// wrappers like withAuth (which require a specific context shape) are assignable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse | Response>;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rateLimitResponse(config: RateLimitConfig, result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { success: false, error: 'Забагато запитів. Спробуйте пізніше.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(config.max),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

function addRateLimitHeaders(
  response: NextResponse | Response,
  config: RateLimitConfig,
  result: RateLimitResult,
): NextResponse | Response {
  response.headers.set('X-RateLimit-Limit', String(config.max));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  return response;
}

/**
 * Creates an API route handler wrapped with Redis-based rate limiting.
 * This is the second layer of defense (after in-memory Edge middleware).
 *
 * Usage:
 * ```ts
 * import { createApiHandler } from '@/lib/api-handler';
 * import { RATE_LIMITS } from '@/services/rate-limit';
 *
 * export const GET = createApiHandler(RATE_LIMITS.api, async (request) => {
 *   return successResponse({ ok: true });
 * });
 * ```
 *
 * Can also wrap authenticated handlers:
 * ```ts
 * export const POST = createApiHandler(RATE_LIMITS.cart, withAuth(async (request, { user }) => {
 *   // handler
 * }));
 * ```
 */
export function createApiHandler(config: RateLimitConfig, handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: unknown) => {
    const ip = getClientIp(request);
    const result = await checkRateLimit(ip, config);

    if (!result.allowed) {
      return rateLimitResponse(config, result);
    }

    const response = await handler(request, context);
    return addRateLimitHeaders(response, config, result);
  };
}
