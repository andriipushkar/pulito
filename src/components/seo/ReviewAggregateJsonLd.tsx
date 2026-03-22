interface ReviewAggregateJsonLdProps {
  productName: string;
  productUrl: string;
  ratingValue: number;
  reviewCount: number;
}

export default function ReviewAggregateJsonLd({
  productName,
  productUrl,
  ratingValue,
  reviewCount,
}: ReviewAggregateJsonLdProps) {
  if (reviewCount === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    url: productUrl,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: ratingValue.toFixed(1),
      bestRating: '5',
      worstRating: '1',
      reviewCount,
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
