import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';
import { escapeXml, escapeCdata, FEED_CACHE_MAX_AGE } from '@/services/product-feeds';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { isSafeUrl } from '@/utils/safe-url';

/**
 * RSS 2.0 feed for the blog. Separate from /feed.xml (which lists products)
 * so blog readers can subscribe without getting catalogue noise.
 *
 * Filters: isPublished=true + deletedAt IS NULL. The atom:link self-pointer
 * helps RSS validators and feed-reader auto-discovery.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicFeed);
  if (!rl.allowed) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const settings = (await getSettings()) as unknown as {
    site_name?: string;
    site_description?: string;
  };

  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true, deletedAt: null },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      category: { select: { name: true } },
      tags: true,
    },
  });

  const items = posts
    .map((p) => {
      const pubDate = (p.publishedAt ?? new Date()).toUTCString();
      const desc = p.excerpt || p.title;
      // Build absolute URL, then check scheme — `javascript:` / `data:` /
      // private IPs would otherwise land in `<enclosure url="...">` and
      // confuse feed validators (and any HTML-rendering RSS reader).
      const coverFullUrl = p.coverImage
        ? /^https?:\/\//i.test(p.coverImage)
          ? p.coverImage
          : `${baseUrl}${p.coverImage.startsWith('/') ? '' : '/'}${p.coverImage}`
        : null;
      const cover =
        coverFullUrl && isSafeUrl(coverFullUrl)
          ? `<enclosure url="${escapeXml(coverFullUrl)}" type="image/jpeg" />`
          : '';
      const tagXml = p.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('');
      return `    <item>
      <title><![CDATA[${escapeCdata(p.title)}]]></title>
      <link>${baseUrl}/blog/${escapeXml(p.slug)}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${escapeXml(p.slug)}</guid>
      <description><![CDATA[${escapeCdata(desc)}]]></description>
      ${p.category ? `<category>${escapeXml(p.category.name)}</category>` : ''}
      ${tagXml}
      <pubDate>${pubDate}</pubDate>
      ${cover}
    </item>`;
    })
    .join('\n');

  const siteName = settings.site_name ?? 'Pulito Trade';
  const siteDesc = settings.site_description ?? 'Блог Pulito Trade';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)} — Блог</title>
    <link>${baseUrl}/blog</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>uk-UA</language>
    <atom:link href="${baseUrl}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${FEED_CACHE_MAX_AGE}, s-maxage=${FEED_CACHE_MAX_AGE}`,
    },
  });
}
