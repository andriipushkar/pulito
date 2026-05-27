import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/account/',
          '/auth/',
          '/checkout/',
          '/cart/',
          // /comparison is user-specific (compared items live in localStorage),
          // so crawl budget is wasted on it. The page also carries noindex but
          // an explicit Disallow stops Google from fetching it at all.
          '/comparison',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
