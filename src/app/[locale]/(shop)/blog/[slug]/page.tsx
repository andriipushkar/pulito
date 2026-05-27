import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
// ISR: revalidate blog post every 5 minutes
export const revalidate = 300;

import Container from '@/components/ui/Container';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import dynamic from 'next/dynamic';
import BlogContent from '@/components/blog/BlogContent';
import BlogJsonLd from '@/components/blog/BlogJsonLd';

// Below-the-fold — defer rendering until after the article body paints.
const RelatedPosts = dynamic(() => import('@/components/blog/RelatedPosts'));
const BlogComments = dynamic(() => import('@/components/blog/BlogComments'));
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import { getPostBySlug, getRelatedPosts } from '@/services/blog';
import { prisma } from '@/lib/prisma';
import { getLocale } from 'next-intl/server';
import { applyTranslationsDeep, applyTranslationsList, buildHreflang } from '@/lib/i18n';

const baseUrl = process.env.APP_URL || 'http://localhost:3000';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const raw = await getPostBySlug(slug);

  if (!raw) {
    return { title: 'Статтю не знайдено — Pulito Trade' };
  }
  const post = applyTranslationsDeep(raw, locale)!;

  const title = post.seoTitle || post.title;
  const description =
    post.seoDescription || post.excerpt || `${post.title} — читайте в блозі Pulito Trade`;
  const url = `${baseUrl}/blog/${slug}`;

  return {
    title: `${title} — Pulito Trade`,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflang(`/blog/${slug}`),
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'Pulito Trade',
      ...(post.publishedAt && { publishedTime: new Date(post.publishedAt).toISOString() }),
      ...(post.updatedAt && { modifiedTime: new Date(post.updatedAt).toISOString() }),
      ...(post.coverImage && {
        images: [
          {
            url: post.coverImage.startsWith('http')
              ? post.coverImage
              : `${baseUrl}${post.coverImage}`,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(post.coverImage && {
        images: [
          post.coverImage.startsWith('http') ? post.coverImage : `${baseUrl}${post.coverImage}`,
        ],
      }),
    },
  };
}

function estimateReadTime(content: string): number {
  const wordCount = content
    .replace(/<[^>]*>/g, '')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const raw = await getPostBySlug(slug);

  if (!raw) {
    // Honour renames: createPost/updatePost record slug changes in
    // SlugRedirect so old URLs keep working (good for SEO + external links).
    const slugRedirect = await prisma.slugRedirect.findUnique({ where: { oldSlug: slug } });
    if (slugRedirect && slugRedirect.type === 'blog_post') {
      redirect(`/blog/${slugRedirect.newSlug}`);
    }
    notFound();
  }
  const post = applyTranslationsDeep(raw, locale)!;

  const relatedPostsRaw = await getRelatedPosts(post.id);
  const relatedPosts = applyTranslationsList(relatedPostsRaw, locale);
  const readTime = estimateReadTime(post.content);
  const url = `${baseUrl}/blog/${slug}`;

  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Блог', href: '/blog' },
    ...(post.category
      ? [{ label: post.category.name, href: `/blog?category=${post.category.slug}` }]
      : []),
    { label: post.title },
  ];

  return (
    <Container className="py-6">
      <BreadcrumbJsonLd
        items={breadcrumbs
          .filter((b) => b.href)
          .map((b) => ({ name: b.label, url: `${baseUrl}${b.href}` }))}
      />
      <BlogJsonLd
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.excerpt || ''}
        url={url}
        image={
          post.coverImage
            ? post.coverImage.startsWith('http')
              ? post.coverImage
              : `${baseUrl}${post.coverImage}`
            : null
        }
        datePublished={
          post.publishedAt
            ? new Date(post.publishedAt).toISOString()
            : new Date(post.createdAt).toISOString()
        }
        dateModified={new Date(post.updatedAt).toISOString()}
        categoryName={post.category?.name}
      />

      <Breadcrumbs items={breadcrumbs} className="mb-4" />

      <article className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="mb-8">
          {post.category && (
            <Link
              href={`/blog?category=${post.category.slug}`}
              className="mb-3 inline-block rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-80"
            >
              {post.category.name}
            </Link>
          )}

          <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
            {post.publishedAt && (
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString('uk-UA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            )}
            <span>{readTime} хв читання</span>
            {post.viewsCount > 0 && <span>{post.viewsCount} переглядів</span>}
          </div>
        </header>

        {/* Cover image */}
        {post.coverImage && (
          <div className="relative mb-8 aspect-[2/1] overflow-hidden rounded-[var(--radius)]">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Content */}
        <BlogContent content={post.content} />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-6">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      <div className="mx-auto max-w-3xl">
        <BlogComments postId={post.id} />
      </div>

      {/* Related posts */}
      <RelatedPosts posts={relatedPosts} />
    </Container>
  );
}
