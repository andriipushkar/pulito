import { prisma } from '@/lib/prisma';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const products = await prisma.product.findMany({
    where: { isActive: true, quantity: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      priceRetail: true,
      priceRetailOld: true,
      quantity: true,
      isPromo: true,
      imagePath: true,
      updatedAt: true,
      content: { select: { shortDescription: true } },
      category: { select: { name: true, slug: true, parent: { select: { name: true } } } },
      images: {
        select: { pathFull: true },
        orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
        take: 1,
      },
    },
  });

  const items = products
    .map((p) => {
      const price = Number(p.priceRetail);
      const oldPrice = p.priceRetailOld ? Number(p.priceRetailOld) : null;
      const image = p.images[0]?.pathFull || p.imagePath;
      const imageUrl = image?.startsWith('http') ? image : image ? `${baseUrl}${image}` : '';
      const description = p.content?.shortDescription || p.name;
      const categoryParts = [
        p.category?.parent?.name,
        p.category?.name,
      ].filter(Boolean);
      const productType = categoryParts.length > 0
        ? categoryParts.join(' > ')
        : 'Побутова хімія';

      return `  <item>
    <g:id>${p.id}</g:id>
    <g:title>${escapeXml(p.name)}</g:title>
    <g:description>${escapeXml(description)}</g:description>
    <g:link>${baseUrl}/product/${p.slug}</g:link>
    ${imageUrl ? `<g:image_link>${escapeXml(imageUrl)}</g:image_link>` : ''}
    <g:availability>in_stock</g:availability>
    <g:price>${price.toFixed(2)} UAH</g:price>
    ${oldPrice && oldPrice > price ? `<g:sale_price>${price.toFixed(2)} UAH</g:sale_price>` : ''}
    <g:condition>new</g:condition>
    <g:mpn>${escapeXml(p.code)}</g:mpn>
    <g:product_type>${escapeXml(productType)}</g:product_type>
    <g:brand>Порошок</g:brand>
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Порошок — Товари</title>
    <link>${baseUrl}</link>
    <description>Каталог товарів інтернет-магазину Порошок</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
