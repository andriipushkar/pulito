import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { checkApiRateLimit } from '@/middleware/api-rate-limit';
import { getRouteLimit } from '@/middleware/rate-limit-config';
import { routing } from '@/i18n/routing';
import { getSettings } from '@/services/settings';
import { PRODUCT_SLUG_REDIRECTS, CATEGORY_SLUG_REDIRECTS } from '@/generated/slug-redirects';

// next-intl handles locale detection + URL rewrites for [locale] segment.
// Paths under these prefixes never carry a locale and must skip i18n.
// IMPORTANT: only list paths whose route files live OUTSIDE app/[locale].
// /auth and /account live INSIDE app/[locale]/(shop) so they MUST be
// localized — adding them here causes /auth/callback to 404 (the same
// happened until 2026-05-25 when this list incorrectly included /auth).
const I18N_EXEMPT_PREFIXES = [
  '/api',
  '/admin',
  '/maintenance',
  '/sitemap',
  '/feed',
  '/blog/feed.xml',
  '/r/',
  '/uploads',
  '/order', // app/order is NOT inside [locale] — kept at root for tracking links
  '/actions',
  '/manifest',
  '/robots',
  '/api-docs',
  '/offline',
];

const intlMiddleware = createIntlMiddleware(routing);

function isI18nPath(pathname: string): boolean {
  // Static-like assets that happen to live at the root must always skip i18n.
  if (
    pathname === '/sw.js' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/llms.txt' ||
    pathname === '/indexnow-key.txt' ||
    pathname === '/feed.xml' ||
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/opengraph-image' ||
    pathname === '/twitter-image' ||
    pathname === '/favicon.ico'
  ) {
    return false;
  }
  return !I18N_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}.`),
  );
}

const MAINTENANCE_ALLOWED_PATHS = ['/maintenance', '/admin', '/api/v1/admin', '/api/v1/auth'];

// Best-effort auth gate for the customer cabinet. Backend routes are scoped
// by `withAuth` + `user.id`, so this only prevents anonymous visitors from
// briefly rendering /account UI while the client-side gate redirects. A user
// with an expired refresh cookie still hits the layout, which handles refresh.
const REFRESH_COOKIE = 'refresh_token';
const ACCOUNT_PATH_RE = /^(?:\/uk)?\/account(?:\/|$)/;

// Paths exempt from CSRF checks (webhooks receive external POST, cron uses Bearer auth, metrics uses sendBeacon)
// '/api/v1/events' is exempt because the analytics tracker flushes on page
// exit via navigator.sendBeacon(), which cannot set the X-Requested-With header
// CSRF requires → every beacon got a 403. The endpoint only records validated
// analytics events (withOptionalAuth), so a forged request is harmless.
const CSRF_EXEMPT_PREFIXES = [
  '/api/webhooks/',
  '/api/v1/cron/',
  '/api/v1/metrics',
  '/api/v1/events',
  // Diagnostic crash reporter — fired from error boundaries via sendBeacon,
  // which cannot set X-Requested-With. Handler only writes capped strings to the
  // server log, so a forged request is harmless. (Temporary — see log-client-error.)
  '/api/v1/log-client-error',
];
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

  // Old → new slug 308 redirects, handled here (before route caching) so renamed
  // products/categories don't 404 on old URLs. The maps are snapshotted from the
  // slugRedirect table at build time (scripts/gen-slug-redirects.cjs, wired into
  // deploy.sh), keeping this a cheap in-memory lookup with no per-request DB hit.
  const productSlugMatch = pathname.match(/^(\/(?:uk|en|pl|ro))?\/product\/([^/]+)\/?$/);
  if (productSlugMatch) {
    const newSlug = PRODUCT_SLUG_REDIRECTS[decodeURIComponent(productSlugMatch[2])];
    if (newSlug) {
      const url = request.nextUrl.clone();
      url.pathname = `${productSlugMatch[1] || ''}/product/${newSlug}`;
      return NextResponse.redirect(url, 308);
    }
  }
  if (/^(\/(?:uk|en|pl|ro))?\/catalog\/?$/.test(pathname)) {
    const cat = request.nextUrl.searchParams.get('category');
    const newCat = cat ? CATEGORY_SLUG_REDIRECTS[cat] : undefined;
    if (newCat) {
      const url = request.nextUrl.clone();
      url.searchParams.set('category', newCat);
      return NextResponse.redirect(url, 308);
    }
  }

  // Operational settings (maintenance flag + admin IP whitelist) now live in
  // the DB so the owner can flip them from /admin without a redeploy. Next 16
  // runs proxy.ts on the Node.js runtime, so getSettings() (Prisma + Redis +
  // 60s in-memory cache) is available here. On DB/Redis failure it returns the
  // defaults, so the site stays up. The matching process.env.* vars still act
  // as an override/fallback for emergencies and first-boot before any save.
  const settings = await getSettings();

  // Admin IP whitelist (optional). Configure in /admin → System, or set
  // ADMIN_ALLOWED_IPS="1.2.3.4,5.6.7.8". Restricts both the admin UI and the
  // admin API. Local IPs (127.0.0.1, ::1) are always allowed so cron and
  // on-box debugging keep working.
  const adminAllowedIps = settings.admin_allowed_ips || process.env.ADMIN_ALLOWED_IPS;
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/v1/admin');
  if (adminAllowedIps && isAdminPath) {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '';
    const LOCAL_IPS = new Set(['127.0.0.1', '::1', 'localhost']);
    const allowedList = adminAllowedIps
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
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

  // Maintenance mode check — DB-backed (toggle from /admin → Maintenance),
  // with the env var as an override. Propagation is bounded by the settings
  // cache TTL (≤60s) since proxy and the admin route hold separate in-memory
  // caches but share the same Redis entry.
  if (settings.maintenance_mode === 'true' || process.env.MAINTENANCE_MODE === 'true') {
    const isAllowed = MAINTENANCE_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed && pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  // Customer cabinet gate: bounce visitors with no refresh cookie to login
  // before the /account UI ever renders.
  if (ACCOUNT_PATH_RE.test(pathname) && !request.cookies.get(REFRESH_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    const original = pathname + (url.search || '');
    url.pathname = '/auth/login';
    url.search = `?redirect=${encodeURIComponent(original)}`;
    return NextResponse.redirect(url);
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

  // Localize the request via next-intl for non-exempt paths. Returns a
  // redirect/rewrite when the locale prefix needs adjusting, otherwise a
  // plain next() response we can decorate with security headers below.
  const response = isI18nPath(pathname) ? intlMiddleware(request) : NextResponse.next();

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
    // 'unsafe-eval' is required by bundled client deps that can't avoid it:
    // a globalThis shim (`new Function("return this")()`) present in many libs,
    // plus @firebase/util's env probe (`eval("__FIREBASE_DEFAULTS__")`). CSP
    // blocking eval threw at module-init and broke the account/cabinet route.
    // The per-request nonce stays the primary XSS defence (inline-script
    // injection is still blocked); unsafe-eval only permits eval/Function,
    // a far narrower vector than unsafe-inline would open.
    `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net`,
    // Styles use 'unsafe-inline' rather than a nonce. Third-party libs (sonner,
    // chart/animation libs, Next.js internals) inject <style> elements at
    // runtime WITHOUT our nonce, and a nonce-only style-src-elem blocked every
    // one of them — flooding the console with CSP violations and leaving some
    // UI unstyled. CSP3 ignores 'unsafe-inline' when a nonce is also present,
    // so the nonce is dropped here. This is a deliberate, low-risk trade-off:
    // style injection can't execute code, and script-src stays strictly
    // nonce-gated (the real XSS defence). style-src-attr already needed
    // 'unsafe-inline' for React's style={{...}} (CSP3 has no attr nonces).
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://www.google-analytics.com https://api.telegram.org https://api.novaposhta.ua",
    'frame-src https://www.google.com https://maps.google.com https://www.openstreetmap.org',
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|uploads|sw.js|google[^/]*\\.html).*)',
  ],
};
