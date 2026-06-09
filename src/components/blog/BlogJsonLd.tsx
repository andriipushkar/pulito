interface BlogJsonLdProps {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  datePublished: string;
  dateModified: string;
  authorName?: string;
  categoryName?: string;
}

export default function BlogJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName,
  categoryName,
}: BlogJsonLdProps) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    ...(image && { image }),
    datePublished,
    dateModified,
    author: {
      '@type': authorName ? 'Person' : 'Organization',
      name: authorName || 'Pulito Trade',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Pulito Trade',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/images/icon-512.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    ...(categoryName && {
      articleSection: categoryName,
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
