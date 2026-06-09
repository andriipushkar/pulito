import type { ProductDetail } from '@/types/product';

interface ProductJsonLdProps {
  product: ProductDetail;
  ratingStats?: { averageRating: number; totalReviews: number } | null;
}

export default function ProductJsonLd({ product, ratingStats }: ProductJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  const price = Number(product.priceRetail);
  const oldPrice = product.priceRetailOld ? Number(product.priceRetailOld) : null;
  // Google requires ABSOLUTE image URLs in Product structured data — a relative
  // /uploads/... path makes Google skip the image (and Merchant Center rejects
  // it). Prepend baseUrl to any non-absolute path.
  const absolutize = (path: string | null | undefined): string | null =>
    !path ? null : /^https?:\/\//i.test(path) ? path : `${baseUrl}${path}`;
  const images = product.images
    .map((img) => absolutize(img.pathFull))
    .filter((url): url is string => Boolean(url));
  const mainImage = images[0] || absolutize(product.imagePath);

  const barcode = (product.barcode ?? '').replace(/\D/g, '');
  const gtinFields: Record<string, string> = {};
  if (barcode.length === 8) gtinFields.gtin8 = barcode;
  else if (barcode.length === 12) gtinFields.gtin12 = barcode;
  else if (barcode.length === 13) gtinFields.gtin13 = barcode;
  else if (barcode.length === 14) gtinFields.gtin14 = barcode;
  if (barcode) gtinFields.gtin = barcode;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.code,
    mpn: product.code,
    ...gtinFields,
    url: `${baseUrl}/product/${product.slug}`,
    ...(product.content?.shortDescription && { description: product.content.shortDescription }),
    ...(images.length > 0 ? { image: images } : mainImage ? { image: mainImage } : {}),
    ...(product.category && { category: product.category.name }),
    brand: {
      '@type': 'Brand',
      name: product.brand?.name || 'Pulito Trade',
    },
    ...(ratingStats &&
      ratingStats.totalReviews > 0 && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: ratingStats.averageRating,
          reviewCount: ratingStats.totalReviews,
        },
      }),
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.slug}`,
      price: price.toFixed(2),
      priceCurrency: 'UAH',
      availability:
        product.quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Pulito Trade',
        url: baseUrl,
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        // Orientовна вартість доставки Новою Поштою (платить отримувач за
        // тарифом перевізника). Google вимагає конкретну суму в shippingRate;
        // ставимо типову. Безкоштовно від 2000 грн — це краще конфігурувати
        // в Merchant Center, ніж у per-product JSON-LD.
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '100.00',
          currency: 'UAH',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'UA',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 1,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 3,
            unitCode: 'DAY',
          },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'UA',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      },
      ...(oldPrice &&
        oldPrice > price && {
          priceValidUntil: product.promoEndDate
            ? new Date(product.promoEndDate).toISOString().split('T')[0]
            : undefined,
        }),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
