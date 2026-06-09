import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
// ISR: revalidate blog listing every 5 minutes
export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Pagination from '@/components/ui/Pagination';
import BlogCard from '@/components/blog/BlogCard';
import PaginationLinks from '@/components/seo/PaginationLinks';
import { getPublishedPosts, getCategories } from '@/services/blog';
import { getLocale, getTranslations } from 'next-intl/server';
import { applyTranslationsList, buildHreflang } from '@/lib/i18n';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

interface BlogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const canonical = page > 1 ? `${baseUrl}/blog?page=${page}` : `${baseUrl}/blog`;

  return {
    title: 'Блог — Pulito Trade',
    description:
      'Корисні статті про побутову хімію, поради з прибирання та догляду за домом від Pulito Trade.',
    // Deep pagination has thin SEO value — each post is in the sitemap on its
    // own. follow=true keeps crawlers walking through to the posts.
    ...(page > 1 && { robots: { index: false, follow: true } }),
    alternates: {
      canonical,
      languages: buildHreflang(page > 1 ? `/blog?page=${page}` : '/blog'),
    },
    openGraph: {
      title: 'Блог — Pulito Trade',
      description: 'Корисні статті про побутову хімію, поради з прибирання та догляду за домом.',
      url: canonical,
      type: 'website',
      siteName: 'Pulito Trade',
      // Default share image so social previews on Facebook/Telegram/Viber
      // never show a blank thumbnail. The /opengraph-image route returns
      // the shop's branded card image.
      images: [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Блог — Pulito Trade',
      description: 'Корисні статті про побутову хімію, поради з прибирання та догляду за домом.',
      images: [`${baseUrl}/opengraph-image`],
    },
  };
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const categorySlug = typeof params.category === 'string' ? params.category : undefined;
  const limit = 12;

  const locale = await getLocale();
  const tBlog = await getTranslations('blog');
  const tBc = await getTranslations('breadcrumb');
  const [{ posts: rawPosts, total }, rawCategories] = await Promise.all([
    getPublishedPosts(page, limit, categorySlug),
    getCategories(),
  ]);
  const posts = applyTranslationsList(rawPosts, locale);
  const categories = applyTranslationsList(rawCategories, locale);

  const totalPages = Math.ceil(total / limit);

  const breadcrumbs = [{ label: tBc('home'), href: '/' }, { label: tBlog('title') }];

  const currentSearchParams: Record<string, string> = {};
  if (categorySlug) currentSearchParams.category = categorySlug;

  const itemListJsonLd =
    posts.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Блог — Pulito Trade',
          url: `${baseUrl}/blog`,
          description:
            'Корисні статті про побутову хімію, поради з прибирання та догляду за домом.',
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
        }
      : null;

  return (
    <Container className="py-6">
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <PaginationLinks
        currentPage={page}
        totalPages={totalPages}
        baseUrl={`${baseUrl}/blog`}
        searchParams={currentSearchParams}
      />
      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <h1 className="mb-6 text-2xl font-bold">{tBlog('title')}</h1>

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
