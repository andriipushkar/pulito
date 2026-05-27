import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { escapeXml, FEED_CACHE_MAX_AGE } from '@/services/product-feeds';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicFeed);
  if (!rl.allowed) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  // Google product category mapping for household chemicals
  const googleCategoryMap: Record<string, string> = {
    // Household cleaning supplies
    default: '623', // Household Supplies > Household Cleaning Supplies
  };

  const products = await prisma.product.findMany({
    // Skip soft-deleted: their /product/{slug} returns 404, and Google
    // Merchant flags 404s aggressively (Disapproved Items → impressions drop).
    where: { isActive: true, deletedAt: null, quantity: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      code: true,
      barcode: true,
      name: true,
      slug: true,
      priceRetail: true,
      priceRetailOld: true,
      quantity: true,
      isPromo: true,
      imagePath: true,
      updatedAt: true,
      brand: { select: { name: true } },
      content: { select: { shortDescription: true } },
      category: {
        select: { name: true, slug: true, parent: { select: { name: true, slug: true } } },
      },
      images: {
        select: { pathFull: true },
        orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
        // Google allows the main image + up to 10 additional ones. Pulling
        // 11 here gives the feed extra photos when the product has them.
        take: 11,
      },
    },
  });

  const items = products
    .map((p) => {
      const price = Number(p.priceRetail);
      const oldPrice = p.priceRetailOld ? Number(p.priceRetailOld) : null;
      const onSale = oldPrice !== null && oldPrice > price;

      const allImages = p.images
        .map((img) => img.pathFull)
        .filter((path): path is string => !!path)
        .map((path) => (path.startsWith('http') ? path : `${baseUrl}${path}`));
      const mainImage = allImages[0] || (p.imagePath ? `${baseUrl}${p.imagePath}` : '');
      const additionalImages = allImages.slice(1, 11);

      const description = p.content?.shortDescription || p.name;
      const categoryParts = [p.category?.parent?.name, p.category?.name].filter(Boolean);
      const productType = categoryParts.length > 0 ? categoryParts.join(' > ') : 'Побутова хімія';

      const categorySlug = p.category?.slug || p.category?.parent?.slug || '';
      const googleCategory = googleCategoryMap[categorySlug] || googleCategoryMap['default'];

      // Google semantics: g:price = regular price; g:sale_price = discounted
      // price when on sale. Old code put discounted price into BOTH fields,
      // so Merchant Center never rendered a strikethrough.
      const regularPrice = onSale && oldPrice ? oldPrice : price;

      return `  <item>
    <g:id>${p.id}</g:id>
    <g:title>${escapeXml(p.name)}</g:title>
    <g:description>${escapeXml(description)}</g:description>
    <g:link>${baseUrl}/product/${p.slug}</g:link>
    ${mainImage ? `<g:image_link>${escapeXml(mainImage)}</g:image_link>` : ''}
    ${additionalImages.map((url) => `<g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`).join('\n    ')}
    <g:availability>in_stock</g:availability>
    <g:price>${regularPrice.toFixed(2)} UAH</g:price>
    ${onSale ? `<g:sale_price>${price.toFixed(2)} UAH</g:sale_price>` : ''}
    <g:condition>new</g:condition>
    <g:mpn>${escapeXml(p.code)}</g:mpn>
    ${p.barcode ? `<g:gtin>${escapeXml(p.barcode)}</g:gtin>` : '<g:identifier_exists>no</g:identifier_exists>'}
    <g:product_type>${escapeXml(productType)}</g:product_type>
    <g:brand>${escapeXml(p.brand?.name || 'Pulito Trade')}</g:brand>
    <g:google_product_category>${googleCategory}</g:google_product_category>
    <g:shipping>
      <g:country>UA</g:country>
      <g:service>Нова Пошта</g:service>
      <g:price>0 UAH</g:price>
    </g:shipping>
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Pulito Trade — Товари</title>
    <link>${baseUrl}</link>
    <description>Каталог товарів інтернет-магазину Pulito Trade</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${FEED_CACHE_MAX_AGE}, s-maxage=${FEED_CACHE_MAX_AGE}`,
    },
  });
}
