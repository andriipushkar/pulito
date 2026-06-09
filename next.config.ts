import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// CDN support: set CDN_URL env to serve static assets from CDN (e.g. Cloudflare, CloudFront)
const cdnUrl = process.env.CDN_URL || '';

// Standalone output is only needed for the Docker image (CMD ["node", "server.js"]).
// For local/VPS deploys we run `next start` via pm2, which warns when standalone
// is enabled even though static traffic still works. Gate it behind an env var
// so the Dockerfile opts in and everyone else gets the clean default.
const standalone = process.env.NEXT_BUILD_STANDALONE === '1';

// Atomic deploys build into a staging dir (NEXT_DIST_DIR=.next-staging) which is
// then renamed over .next in one mv. `next build` and `next start` both read
// distDir from here, so the same env var drives both. Defaults to .next.
const distDir = process.env.NEXT_DIST_DIR || '.next';

// Per-build identifier surfaced to the client so the service worker can scope
// its caches to this deploy (see public/sw.js + ServiceWorkerRegistration.tsx).
// deploy.sh sets BUILD_ID; for plain `next build` we fall back to a timestamp.
// Each build yields a new value, which changes the SW registration URL and
// forces stale caches/chunks from the previous build to be purged.
const swVersion = process.env.BUILD_ID || String(Date.now());

const nextConfig: NextConfig = {
  distDir,
  env: {
    NEXT_PUBLIC_SW_VERSION: swVersion,
  },
  ...(standalone && { output: 'standalone' as const }),
  ...(cdnUrl && { assetPrefix: cdnUrl }),
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000,
    ...(cdnUrl && {
      loader: 'default',
      path: `${cdnUrl}/_next/image`,
    }),
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
      { protocol: 'https', hostname: '*.cloudfront.net' }, // CDN
      { protocol: 'https', hostname: '*.googleapis.com' }, // Google APIs
      { protocol: 'http', hostname: 'localhost' }, // Dev
    ],
  },
  // `pg` + `@prisma/adapter-pg` must stay external from Turbopack's bundler.
  // Without listing them, the build emits an `externalImport('pg-<hash>')`
  // call that fails at runtime ("Cannot find package 'pg-587764f...'"), and
  // every /api request crashes (Next 16.2.x + Turbopack + adapter regression).
  serverExternalPackages: [
    'pdfkit',
    'fontkit',
    'linebreak',
    'png-js',
    'sharp',
    'pg',
    'pg-cloudflare',
    '@prisma/adapter-pg',
  ],
  // Turbopack tries to bundle `pg-cloudflare` and chokes on its
  // `import('cloudflare:sockets')` (Workers-only specifier). Aliasing to a
  // local stub lets the build complete; the stub is never executed in Node.
  turbopack: {
    resolveAlias: {
      'pg-cloudflare': './src/lib/empty-pg-cloudflare.js',
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Cap build parallelism at 2 workers. This box has 4 cores but only ~6GB
    // free RAM (Postgres/Redis/Typesense run alongside in Docker); the default
    // 3 workers each spawn a heap and peaked past RAM, triggering OOM kills
    // (exit 137) that left a half-written .next and took the site down on
    // restart. 2 workers keeps the memory ceiling safe at a small time cost.
    cpus: 2,
    // Trade a little compile time for a much lower webpack memory ceiling.
    // The compile phase peaked ~6GB RSS on a 7.6GB box and thrashed swap
    // (a deploy ran ~40 min); this flag keeps webpack from holding the full
    // module graph in memory at once. Output is unchanged.
    webpackMemoryOptimizations: true,
  },
  async headers() {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const allowedOrigins = [appUrl, 'http://localhost:3000'];

    return [
      // Static assets — long cache for Cloudflare CDN
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Fonts, SW, manifest — long cache
      {
        source: '/:path*.woff2',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      // API — no cache (Cloudflare must not cache dynamic responses)
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store' }],
      },
      // CORS for API routes — only allow own origin
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins[0] },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, X-Idempotency-Key',
          },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          // COEP and COOP intentionally omitted: third-party iframes
          // (OpenStreetMap embed.html, Google Maps, payment 3-D Secure) don't
          // ship CORP headers nor matching opener policy, so setting these
          // causes Firefox to refuse the iframe with "security configuration
          // doesn't match the previous page". Same comment as in proxy.ts.
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Download-Options',
            value: 'noopen',
          },
          // CSP is set dynamically in proxy.ts with per-request nonce
        ],
      },
    ];
  },
};

// Bundle analyzer: run with ANALYZE=true npm run build
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config: NextConfig) => config;

export default withBundleAnalyzer(withNextIntl(nextConfig));
