import type { Metadata } from 'next';
import Link from 'next/link';

// ISR: revalidate blog listing every 5 minutes
export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import BlogCard from '@/components/blog/BlogCard';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import { getPublishedPosts, getCategories } from '@/services/blog';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

interface BlogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const canonical = page > 1 ? `${baseUrl}/blog?page=${page}` : `${baseUrl}/blog`;

  return {
    title: 'Блог — Порошок',
    description: 'Корисні статті про побутову хімію, поради з прибирання та догляду за домом від Порошок.',
    alternates: {
      canonical,
      languages: {
        'uk': canonical,
        'en': `${baseUrl}/en/blog${page > 1 ? `?page=${page}` : ''}`,
        'x-default': canonical,
      },
    },
    openGraph: {
      title: 'Блог — Порошок',
      description: 'Корисні статті про побутову хімію, поради з прибирання та догляду за домом.',
      url: canonical,
      type: 'website',
      siteName: 'Порошок',
    },
  };
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const categorySlug = typeof params.category === 'string' ? params.category : undefined;
  const limit = 12;

  const [{ posts, total }, categories] = await Promise.all([
    getPublishedPosts(page, limit, categorySlug),
    getCategories(),
  ]);

  const totalPages = Math.ceil(total / limit);

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Блог' },
  ];

  const currentSearchParams: Record<string, string> = {};
  if (categorySlug) currentSearchParams.category = categorySlug;

  const itemListJsonLd = posts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Блог — Порошок',
    url: `${baseUrl}/blog`,
    description: 'Корисні статті про побутову хімію, поради з прибирання та догляду за домом.',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: (page - 1) * limit + index + 1,
        url: `${baseUrl}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  } : null;

  return (
    <Container className="py-6">
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <BreadcrumbJsonLd
        items={breadcrumbs
          .filter((b) => b.href)
          .map((b) => ({ name: b.label, url: `${baseUrl}${b.href}` }))}
      />
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">Блог</h1>

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          <Link
            href="/blog"
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !categorySlug
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            Всі статті
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/blog?category=${cat.slug}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                categorySlug === cat.slug
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {cat.name}
              {cat._count?.posts > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({cat._count.posts})</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="py-12 text-center text-[var(--color-text-secondary)]">
          {categorySlug
            ? 'У цій категорії поки немає статей.'
            : 'Наразі немає опублікованих статей. Слідкуйте за оновленнями!'}
        </p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <BlogCard key={post.id} post={post} index={index} />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl="/blog"
            searchParams={currentSearchParams}
            className="mt-8"
          />
        </>
      )}
    </Container>
  );
}
