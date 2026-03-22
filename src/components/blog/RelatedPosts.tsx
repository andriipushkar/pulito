import BlogCard from './BlogCard';

interface RelatedPost {
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
}

interface RelatedPostsProps {
  posts: RelatedPost[];
}

export default function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 border-t border-[var(--color-border)] pt-8">
      <h2 className="mb-6 text-2xl font-bold">Схожі статті</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {posts.slice(0, 4).map((post, index) => (
          <BlogCard key={post.slug} post={post} index={index} />
        ))}
      </div>
    </section>
  );
}
