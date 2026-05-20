import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';

/**
 * RSS 2.0 feed for the blog. Separate from /feed.xml (which lists products)
 * so blog readers can subscribe without getting catalogue noise.
 *
 * Filters: isPublished=true + deletedAt IS NULL. The atom:link self-pointer
 * helps RSS validators and feed-reader auto-discovery.
 */
export async function GET() {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const settings = await getSettings() as unknown as { site_name?: string; site_description?: string };

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
      const cover = p.coverImage
        ? `<enclosure url="${baseUrl}${p.coverImage.startsWith('/') ? '' : '/'}${p.coverImage}" type="image/jpeg" />`
        : '';
      const tagXml = p.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('');
      return `    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${baseUrl}/blog/${p.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${p.slug}</guid>
      <description><![CDATA[${desc}]]></description>
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
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
