import Link from 'next/link';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';

interface BlogCardProps {
  post: {
    slug: string;
    title: string;
    excerpt?: string | null;
    coverImage?: string | null;
    publishedAt: Date | string | null;
    content: string;
    category?: {
      name: string;
      slug: string;
    } | null;
  };
  index?: number;
}

function estimateReadTime(content: string): number {
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BlogCard({ post, index = 0 }: BlogCardProps) {
  const readTime = estimateReadTime(post.content);

  return (
    <AnimateOnScroll delay={index * 100}>
      <Link href={`/blog/${post.slug}`} className="group block h-full">
        <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] transition-shadow hover:shadow-[var(--shadow-md)]">
          <div className="relative aspect-video bg-[var(--color-bg-secondary)]">
            {post.coverImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.coverImage}
                alt={post.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--color-text-secondary)]">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
            )}
            {post.category && (
              <span className="absolute left-3 top-3 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-white">
                {post.category.name}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="mb-2 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
              {post.publishedAt && (
                <time dateTime={new Date(post.publishedAt).toISOString()}>
                  {formatDate(post.publishedAt)}
                </time>
              )}
              <span>{readTime} хв читання</span>
            </div>

            <h2 className="mb-2 line-clamp-2 text-lg font-semibold transition-colors group-hover:text-[var(--color-primary)]">
              {post.title}
            </h2>

            {post.excerpt && (
              <p className="mb-4 line-clamp-3 flex-1 text-sm text-[var(--color-text-secondary)]">
                {post.excerpt}
              </p>
            )}

            <span className="mt-auto inline-flex items-center text-sm font-medium text-[var(--color-primary)]">
              Читати далі
              <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </article>
      </Link>
    </AnimateOnScroll>
  );
}
