import type { ProductDetail } from '@/types/product';

interface ProductJsonLdProps {
  product: ProductDetail;
}

export default function ProductJsonLd({ product }: ProductJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  const price = Number(product.priceRetail);
  const oldPrice = product.priceRetailOld ? Number(product.priceRetailOld) : null;
  const images = product.images
    .map((img) => img.pathFull)
    .filter(Boolean);
  const mainImage = images[0] || product.imagePath;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.code,
    mpn: product.code,
    url: `${baseUrl}/product/${product.slug}`,
    ...(product.content?.shortDescription && { description: product.content.shortDescription }),
    ...(images.length > 0 ? { image: images } : mainImage ? { image: mainImage } : {}),
    ...(product.category && { category: product.category.name }),
    brand: {
      '@type': 'Brand',
      name: 'Порошок',
    },
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/product/${product.slug}`,
      price: price.toFixed(2),
      priceCurrency: 'UAH',
      availability: product.quantity > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Порошок',
        url: baseUrl,
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
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
      ...(oldPrice && oldPrice > price && {
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
