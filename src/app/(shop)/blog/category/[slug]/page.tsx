import type { Metadata } from 'next';

// ISR: revalidate category page every 5 minutes
export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import BlogCard from '@/components/blog/BlogCard';
import Link from 'next/link';
import { getPublishedPosts, getCategories } from '@/services/blog';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

interface BlogCategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function getCategoryBySlug(slug: string) {
  return prisma.blogCategory.findUnique({
    where: { slug },
  });
}

export async function generateMetadata({ params }: BlogCategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: 'Категорію не знайдено — Порошок' };
  }

  const title = category.seoTitle || `${category.name} — Блог Порошок`;
  const description = category.seoDescription || `Статті в категорії "${category.name}" — блог Порошок`;
  const url = `${baseUrl}/blog/category/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'uk': url,
        'en': `${baseUrl}/en/blog/category/${slug}`,
        'x-default': url,
      },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Порошок',
    },
  };
}

export default async function BlogCategoryPage({ params, searchParams }: BlogCategoryPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 12;

  const [category, { posts, total }, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getPublishedPosts(page, limit, slug),
    getCategories(),
  ]);

  if (!category) {
    notFound();
  }

  const totalPages = Math.ceil(total / limit);

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Блог', href: '/blog' },
    { label: category.name },
  ];

  return (
    <Container className="py-6">
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">{category.name}</h1>

      {category.description && (
        <p className="mb-6 text-[var(--color-text-secondary)]">{category.description}</p>
      )}

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          <Link
            href="/blog"
            className="shrink-0 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            Всі статті
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/blog/category/${cat.slug}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                slug === cat.slug
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
          У цій категорії поки немає статей.
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
            baseUrl={`/blog/category/${slug}`}
            className="mt-8"
          />
        </>
      )}
    </Container>
  );
}
