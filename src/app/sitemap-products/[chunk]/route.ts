import { prisma } from '@/lib/prisma';

const PRODUCTS_PER_SITEMAP = 5000;

/**
 * Dynamic product sitemap chunks: /sitemap-products/0, /sitemap-products/1, etc.
 * Each chunk returns up to 5000 product URLs in XML format.
 * This prevents timeout on servers with 10,000+ products.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chunk: string }> }
) {
  const { chunk } = await params;
  const chunkIndex = parseInt(chunk, 10);
  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return new Response('Not found', { status: 404 });
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { id: 'asc' },
    skip: chunkIndex * PRODUCTS_PER_SITEMAP,
    take: PRODUCTS_PER_SITEMAP,
  });

  if (products.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  const urls = products
    .map(
      (p) =>
        `  <url>
    <loc>${baseUrl}/product/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
