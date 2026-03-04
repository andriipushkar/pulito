import { prisma } from '@/lib/prisma';

export async function GET() {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const products = await prisma.product.findMany({
    where: { isActive: true },
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
      <title><![CDATA[${p.name}]]></title>
      <link>${baseUrl}/product/${p.slug}</link>
      <description><![CDATA[${p.content?.shortDescription || p.name}]]></description>
      <category>${p.category?.name || ''}</category>
      <pubDate>${p.createdAt.toUTCString()}</pubDate>
      <guid isPermaLink="true">${baseUrl}/product/${p.slug}</guid>
    </item>`
    )
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Порошок — Нові товари</title>
    <link>${baseUrl}</link>
    <description>Нові товари побутової хімії в інтернет-магазині Порошок</description>
    <language>uk</language>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
