import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';
import { escapeXml, escapeCdata, FEED_CACHE_MAX_AGE } from '@/services/product-feeds';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicFeed);
  if (!rl.allowed) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const settings = await getSettings();

  const products = await prisma.product.findMany({
    // Soft-deleted products would route to 404 on Google's side — silently
    // tank Merchant Center quality score until rebuild. Filter both flags.
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      name: true,
      slug: true,
      priceRetail: true,
      createdAt: true,
      categoryId: true,
      content: { select: { shortDescription: true } },
      category: { select: { name: true } },
    },
  });

  const items = products
    .map(
      (p) => `    <item>
      <title><![CDATA[${escapeCdata(p.name)}]]></title>
      <link>${baseUrl}/product/${escapeXml(p.slug)}</link>
      <description><![CDATA[${escapeCdata(p.content?.shortDescription || p.name)}]]></description>
      <category>${escapeXml(p.category?.name || '')}</category>
      <pubDate>${p.createdAt.toUTCString()}</pubDate>
      <guid isPermaLink="true">${baseUrl}/product/${escapeXml(p.slug)}</guid>
    </item>`,
    )
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.site_name)} — Нові товари</title>
    <link>${baseUrl}</link>
    <description>Нові товари побутової хімії в інтернет-магазині ${escapeXml(settings.site_name)}</description>
    <language>uk</language>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${FEED_CACHE_MAX_AGE}, s-maxage=${FEED_CACHE_MAX_AGE}`,
    },
  });
}
