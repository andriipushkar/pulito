import type { Metadata } from 'next';

// ISR: revalidate news every 5 minutes
export const revalidate = 300;

import Link from 'next/link';
import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import { prisma } from '@/lib/prisma';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Новини та акції — Порошок',
  description: 'Останні новини, акції та спеціальні пропозиції від Порошок',
  alternates: {
    canonical: `${baseUrl}/news`,
    languages: {
      'uk': `${baseUrl}/news`,
      'en': `${baseUrl}/en/news`,
      'x-default': `${baseUrl}/news`,
    },
  },
};

async function getPublications(page: number = 1) {
  const limit = 12;

  // Fetch all published publications to filter by channel
  const allPublished = await prisma.publication.findMany({
    where: {
      status: 'published',
      publishedAt: { not: null },
    },
    select: {
      id: true,
      channels: true,
    },
    orderBy: { publishedAt: 'desc' },
  });

  // Filter for publications that include 'site' in channels JSON array
  const siteIds = allPublished
    .filter((p) => {
      const channels = p.channels;
      return Array.isArray(channels) && (channels as string[]).includes('site');
    })
    .map((p) => p.id);

  const total = siteIds.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const paginatedIds = siteIds.slice(skip, skip + limit);

  const publications = paginatedIds.length > 0
    ? await prisma.publication.findMany({
        where: { id: { in: paginatedIds } },
        select: {
          id: true,
          title: true,
          content: true,
          imagePath: true,
          hashtags: true,
          publishedAt: true,
          product: {
            select: { id: true, name: true, slug: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
      })
    : [];

  return { publications, total, totalPages };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { publications, totalPages } = await getPublications(page);

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Новини та акції' },
  ];

  const itemListJsonLd = publications.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Новини та акції — Порошок',
    numberOfItems: publications.length,
    itemListElement: publications.map((pub, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'NewsArticle',
        headline: pub.title,
        ...(pub.content && { description: pub.content.slice(0, 200) }),
        ...(pub.imagePath && { image: pub.imagePath }),
        ...(pub.publishedAt && { datePublished: pub.publishedAt.toISOString() }),
        publisher: {
          '@type': 'Organization',
          name: 'Порошок',
          url: baseUrl,
        },
      },
    })),
  } : null;

  return (
    <Container className="py-6">
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">Новини та акції</h1>

      {publications.length === 0 ? (
        <p className="py-12 text-center text-[var(--color-text-secondary)]">
          Наразі немає новин. Слідкуйте за оновленнями!
        </p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {publications.map((pub) => (
              <article
                key={pub.id}
                className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] transition-shadow hover:shadow-[var(--shadow-md)]"
              >
                {pub.imagePath && (
                  <div className="aspect-video bg-[var(--color-bg-secondary)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pub.imagePath}
                      alt={pub.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-4">
                  <time
                    dateTime={pub.publishedAt?.toISOString()}
                    className="mb-2 block text-xs text-[var(--color-text-secondary)]"
                  >
                    {pub.publishedAt?.toLocaleDateString('uk-UA', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                  <h2 className="mb-2 text-lg font-semibold">{pub.title}</h2>
                  <p className="mb-3 line-clamp-3 text-sm text-[var(--color-text-secondary)]">
                    {pub.content}
                  </p>
                  {pub.hashtags && (
                    <p className="mb-3 text-xs text-[var(--color-primary)]">{pub.hashtags}</p>
                  )}
                  {pub.product && (
                    <Link
                      href={`/product/${pub.product.slug}`}
                      className="inline-block rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
                    >
                      Переглянути товар
                    </Link>
                  )}
                  {pub.category && !pub.product && (
                    <Link
                      href={`/catalog?category=${pub.category.slug}`}
                      className="inline-block rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-bg-secondary)]"
                    >
                      {pub.category.name}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl="/news"
            className="mt-8"
          />
        </>
      )}
    </Container>
  );
}
