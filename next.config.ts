import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// CDN support: set CDN_URL env to serve static assets from CDN (e.g. Cloudflare, CloudFront)
const cdnUrl = process.env.CDN_URL || '';

const nextConfig: NextConfig = {
  output: 'standalone',
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
  serverExternalPackages: ['pdfkit', 'fontkit', 'linebreak', 'png-js', 'sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const allowedOrigins = [appUrl, 'http://localhost:3000'];

    return [
      // CORS for API routes — only allow own origin
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins[0] },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, X-Idempotency-Key' },
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
          // CSP is set dynamically in middleware.ts with per-request nonce
        ],
      },
    ];
  },
};

// Bundle analyzer: run with ANALYZE=true npm run build
const withBundleAnalyzer = process.env.ANALYZE === 'true'
   
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config: NextConfig) => config;

export default withBundleAnalyzer(withNextIntl(nextConfig));
