import { NextRequest, NextResponse } from 'next/server';

const MAINTENANCE_ALLOWED_PATHS = ['/maintenance', '/admin', '/api/v1/admin', '/api/v1/auth'];

// Paths exempt from CSRF checks (webhooks receive external POST, cron uses Bearer auth, metrics uses sendBeacon)
const CSRF_EXEMPT_PREFIXES = ['/api/webhooks/', '/api/v1/cron/', '/api/v1/metrics'];
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Global rate limiter (in-memory per instance) — first line of defense.
// Edge Runtime cannot use ioredis, so this is intentionally in-memory.
// For multi-instance: use Cloudflare Rate Limiting or nginx limit_req as primary.
//
// Per-endpoint Redis-based rate limiting (cluster-safe):
// - /api/v1/auth/login: 5 req/15min (src/services/rate-limit.ts)
// - /api/v1/callback-request: 3 req/15min (sensitive preset)
// - /api/v1/subscribe: 3 req/15min (sensitive preset)
// - Server Actions: checkout 5/min, cart 30/min, review 5/15min
const GLOBAL_RATE_LIMIT = 120; // requests per window
const GLOBAL_RATE_WINDOW = 60; // seconds

// In-memory fallback for when Redis is unreachable
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

// In-memory sliding window rate limiter.
// Note: ioredis cannot run in Edge Runtime (Next.js middleware),
// so we use in-memory rate limiting here. For multi-instance deployments,
// move rate limiting to a Node.js API route or reverse proxy.
function checkGlobalRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now >= entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_WINDOW * 1000 });
    return true;
  }

  entry.count++;

  // Periodic cleanup
  if (ipRequestCounts.size > 10000) {
    for (const [k, v] of ipRequestCounts) {
      if (now >= v.resetAt) ipRequestCounts.delete(k);
    }
  }

  return entry.count <= GLOBAL_RATE_LIMIT;
}

/** Resolve the effective host, preferring X-Forwarded-Host for reverse-proxy setups. */
function getEffectiveHost(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-host') || request.headers.get('host');
}

/** Build the set of trusted hosts: effective host + APP_URL host (for reverse proxies / tunnels). */
function getTrustedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const effectiveHost = getEffectiveHost(request);
  if (effectiveHost) hosts.add(effectiveHost);

  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host);
    } catch { /* ignore invalid APP_URL */ }
  }

  // Trust localhost (server always accepts its own requests)
  hosts.add('localhost:3000');
  hosts.add('localhost');
  hosts.add('127.0.0.1:3000');
  hosts.add('127.0.0.1');

  return hosts;
}

function checkCsrf(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Only check mutating API requests
  if (!pathname.startsWith('/api') || !MUTATING_METHODS.has(request.method)) {
    return null;
  }

  // Skip exempt paths
  if (CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const trustedHosts = getTrustedHosts(request);

  // Check Origin header against trusted hosts
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (!trustedHosts.has(originHost)) {
        return NextResponse.json({ error: 'CSRF check failed: origin mismatch' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'CSRF check failed: invalid origin' }, { status: 403 });
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (!trustedHosts.has(refererHost)) {
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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin IP whitelist (optional). Set ADMIN_ALLOWED_IPS="1.2.3.4,5.6.7.8" to restrict admin access.
  const adminAllowedIps = process.env.ADMIN_ALLOWED_IPS;
  if (adminAllowedIps && pathname.startsWith('/admin')) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
    const allowedList = adminAllowedIps.split(',').map((ip) => ip.trim());
    if (!allowedList.includes(clientIp)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // Maintenance mode check
  if (process.env.MAINTENANCE_MODE === 'true') {
    const isAllowed = MAINTENANCE_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed && pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  // Global rate limiting for API routes (Redis-based, safe for multi-instance)
  if (pathname.startsWith('/api')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const allowed = checkGlobalRateLimit(ip);
    if (!allowed) {
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

  // Request correlation ID — allows tracing requests across logs
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-Id', requestId);
  request.headers.set('x-request-id', requestId);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // CSP with per-request nonce — replaces unsafe-inline for scripts
  const nonce = crypto.randomUUID().replace(/-/g, '');
  response.headers.set('X-Nonce', nonce);
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://www.google-analytics.com https://api.telegram.org https://api.novaposhta.ua",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; '));

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|uploads|sw.js).*)'],
};
