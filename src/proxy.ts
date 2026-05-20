import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/middleware/api-rate-limit';
import { getRouteLimit } from '@/middleware/rate-limit-config';

const MAINTENANCE_ALLOWED_PATHS = ['/maintenance', '/admin', '/api/v1/admin', '/api/v1/auth'];

// Paths exempt from CSRF checks (webhooks receive external POST, cron uses Bearer auth, metrics uses sendBeacon)
const CSRF_EXEMPT_PREFIXES = ['/api/webhooks/', '/api/v1/cron/', '/api/v1/metrics'];
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
    } catch {
      /* ignore invalid APP_URL */
    }
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
      { status: 403 },
    );
  }

  return null;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin IP whitelist (optional). Set ADMIN_ALLOWED_IPS="1.2.3.4,5.6.7.8" to
  // restrict both the admin UI and the admin API. Local IPs (127.0.0.1, ::1)
  // are always allowed so cron and on-box debugging keep working.
  const adminAllowedIps = process.env.ADMIN_ALLOWED_IPS;
  const isAdminPath =
    pathname.startsWith('/admin') || pathname.startsWith('/api/v1/admin');
  if (adminAllowedIps && isAdminPath) {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '';
    const LOCAL_IPS = new Set(['127.0.0.1', '::1', 'localhost']);
    const allowedList = adminAllowedIps.split(',').map((ip) => ip.trim()).filter(Boolean);
    const allowed = LOCAL_IPS.has(clientIp) || allowedList.includes(clientIp);
    if (!allowed) {
      // For UI paths give a human-readable HTML block; for API give JSON so
      // the frontend's apiClient can surface the error cleanly.
      if (pathname.startsWith('/api')) {
        return NextResponse.json(
          { success: false, error: 'Доступ заборонено: IP не в дозволеному списку' },
          { status: 403 },
        );
      }
      const html = `<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><title>Доступ заборонено</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa}.card{max-width:480px;text-align:center;padding:32px;background:#fff;border-radius:16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}h1{margin:0 0 8px;color:#dc2626;font-size:22px}p{color:#555;font-size:14px;line-height:1.5}code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px}</style></head><body><div class="card"><h1>🔒 Доступ заборонено</h1><p>Адмін-панель обмежена за списком IP-адрес.</p><p>Ваша IP: <code>${clientIp || 'невідома'}</code></p><p>Зверніться до власника, щоб додати її до <code>ADMIN_ALLOWED_IPS</code>.</p></div></body></html>`;
      return new NextResponse(html, {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  // Maintenance mode check
  if (process.env.MAINTENANCE_MODE === 'true') {
    const isAllowed = MAINTENANCE_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed && pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  // Per-route rate limiting for API routes (in-memory per instance).
  // Edge Runtime cannot use ioredis, so this is intentionally in-memory.
  // For multi-instance: use Cloudflare Rate Limiting or nginx limit_req as primary.
  //
  // Per-endpoint Redis-based rate limiting (cluster-safe) also applies in route handlers:
  // - /api/v1/auth/login: 5 req/15min (src/services/rate-limit.ts)
  // - /api/v1/callback-request: 3 req/15min (sensitive preset)
  // - /api/v1/subscribe: 3 req/15min (sensitive preset)
  // - Server Actions: checkout 5/min, cart 30/min, review 5/15min
  if (pathname.startsWith('/api') && process.env.DISABLE_RATE_LIMIT !== '1') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateResult = await checkApiRateLimit(pathname, ip);
    if (!rateResult.allowed) {
      const routeLimit = getRouteLimit(pathname);
      return NextResponse.json(
        { success: false, error: 'Забагато запитів. Спробуйте пізніше.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(routeLimit.window),
            'X-RateLimit-Limit': String(routeLimit.max),
            'X-RateLimit-Remaining': '0',
          },
        },
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
  // COEP and COOP intentionally omitted. Third-party iframes (OpenStreetMap
  // map embed, Google Maps, payment provider 3-D Secure) don't ship the CORP
  // headers nor matching opener policies, so any value here makes Firefox
  // refuse to load the iframe with "security configuration doesn't match the
  // previous page". Re-enable only if all embedded third parties are dropped
  // or proxied through our own origin.
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Download-Options', 'noopen');

  // CSP with per-request nonce — replaces unsafe-inline for scripts
  const nonce = crypto.randomUUID().replace(/-/g, '');
  response.headers.set('X-Nonce', nonce);

  const cspReportUri = process.env.SENTRY_CSP_REPORT_URI;

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://www.google-analytics.com https://api.telegram.org https://api.novaposhta.ua",
    "frame-src https://www.google.com https://maps.google.com https://www.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];

  if (cspReportUri) {
    cspDirectives.push(`report-uri ${cspReportUri}`);
    cspDirectives.push('report-to csp-endpoint');

    // Report-To header (newer API, works alongside report-uri for backward compatibility)
    response.headers.set(
      'Report-To',
      JSON.stringify({
        group: 'csp-endpoint',
        max_age: 10886400,
        endpoints: [{ url: cspReportUri }],
      }),
    );
  }

  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|uploads|sw.js).*)'],
};
