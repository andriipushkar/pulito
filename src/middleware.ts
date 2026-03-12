import { NextRequest, NextResponse } from 'next/server';

const MAINTENANCE_ALLOWED_PATHS = ['/maintenance', '/admin', '/api/v1/admin', '/api/v1/auth'];

// Paths exempt from CSRF checks (webhooks receive external POST, cron uses Bearer auth, metrics uses sendBeacon)
const CSRF_EXEMPT_PREFIXES = ['/api/webhooks/', '/api/v1/cron/', '/api/v1/metrics'];
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// In-memory sliding window rate limiter for middleware (Redis is too slow for edge middleware)
// This provides a first line of defense; per-route Redis rate limiting is more precise.
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_RATE_LIMIT = 120; // requests per window
const GLOBAL_RATE_WINDOW = 60_000; // 1 minute

function checkGlobalRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now >= entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_WINDOW });
    return true;
  }

  entry.count++;
  return entry.count <= GLOBAL_RATE_LIMIT;
}

// Periodically clean up stale entries (every 5 min)
let lastCleanup = Date.now();
function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [ip, entry] of ipRequestCounts) {
    if (now >= entry.resetAt) ipRequestCounts.delete(ip);
  }
}

/** Resolve the effective host, preferring X-Forwarded-Host for reverse-proxy setups. */
function getEffectiveHost(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-host') || request.headers.get('host');
}

function checkCsrf(request: NextRequest): NextResponse | null {
  // Skip CSRF checks entirely in development (Dev Tunnels, etc.)
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  const { pathname } = request.nextUrl;

  // Only check mutating API requests
  if (!pathname.startsWith('/api') || !MUTATING_METHODS.has(request.method)) {
    return null;
  }

  // Skip exempt paths
  if (CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const effectiveHost = getEffectiveHost(request);

  // Check Origin header against the effective host
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== effectiveHost) {
        return NextResponse.json({ error: 'CSRF check failed: origin mismatch' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'CSRF check failed: invalid origin' }, { status: 403 });
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== effectiveHost) {
        return NextResponse.json({ error: 'CSRF check failed: referer mismatch' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'CSRF check failed: invalid referer' }, { status: 403 });
    }
  }

  // Require X-Requested-With header (blocks plain form submissions)
  const xRequestedWith = request.headers.get('x-requested-with');
  if (!xRequestedWith) {
    return NextResponse.json(
      { error: 'CSRF check failed: missing X-Requested-With header' },
      { status: 403 }
    );
  }

  return null;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Maintenance mode check
  if (process.env.MAINTENANCE_MODE === 'true') {
    const isAllowed = MAINTENANCE_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed && pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  // Global rate limiting for API routes
  if (pathname.startsWith('/api')) {
    cleanupRateLimitMap();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkGlobalRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Забагато запитів. Спробуйте пізніше.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(GLOBAL_RATE_LIMIT),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // CSRF protection for mutating API requests
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|uploads|sw.js).*)'],
};
