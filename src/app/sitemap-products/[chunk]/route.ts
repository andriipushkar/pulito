import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PRODUCTS_PER_SITEMAP = 5000;
const IMAGES_PER_PRODUCT = 5; // Google Image sitemap caps at 1000 per page url — 5 is plenty

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Dynamic product sitemap chunks: /sitemap-products/0, /sitemap-products/1, etc.
 * Each chunk returns up to 5000 product URLs in XML format with embedded
 * <image:image> tags so Google Images indexes the product photos alongside
 * the product page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ chunk: string }> }) {
  const { chunk } = await params;
  const chunkIndex = parseInt(chunk, 10);
  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return new Response('Not found', { status: 404 });
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      name: true,
      updatedAt: true,
      images: {
        select: { pathFull: true, altText: true },
        orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
        take: IMAGES_PER_PRODUCT,
      },
    },
    orderBy: { id: 'asc' },
    skip: chunkIndex * PRODUCTS_PER_SITEMAP,
    take: PRODUCTS_PER_SITEMAP,
  });

  if (products.length === 0) {
    return new Response('Not found', { status: 404 });
  }

  const urls = products
    .map((p) => {
      const imageTags = p.images
        .filter((img): img is { pathFull: string; altText: string | null } => !!img.pathFull)
        .map((img) => {
          const loc = img.pathFull.startsWith('http') ? img.pathFull : `${baseUrl}${img.pathFull}`;
          const caption = img.altText || p.name;
          return `    <image:image>
      <image:loc>${escapeXml(loc)}</image:loc>
      <image:caption>${escapeXml(caption)}</image:caption>
    </image:image>`;
        })
        .join('\n');

      return `  <url>
    <loc>${baseUrl}/product/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${imageTags}
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
