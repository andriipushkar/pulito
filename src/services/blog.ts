import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { sanitizeHtml } from '@/utils/sanitize';

export class BlogError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'BlogError';
  }
}

/** Google SERP cuts title around 60–70 chars and description around 155–160. */
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 160;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1).trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base}…`;
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveSeoFallback(
  seoTitle: string | undefined,
  seoDescription: string | undefined,
  title: string,
  excerpt: string | undefined,
  content: string,
): { seoTitle: string; seoDescription: string } {
  const resolvedTitle = seoTitle?.trim() || truncate(title.trim(), SEO_TITLE_MAX);
  const descSource =
    seoDescription?.trim() || (excerpt ? plainText(excerpt) : '') || plainText(content);
  const resolvedDescription = truncate(descSource, SEO_DESCRIPTION_MAX);
  return { seoTitle: resolvedTitle, seoDescription: resolvedDescription };
}

export async function createPost(
  data: {
    title: string;
    slug?: string;
    content: string;
    excerpt?: string;
    coverImage?: string;
    categoryId?: number;
    tags?: string[];
    seoTitle?: string;
    seoDescription?: string;
    titleEn?: string;
    excerptEn?: string;
    contentEn?: string;
    seoTitleEn?: string;
    seoDescriptionEn?: string;
    isPublished?: boolean;
  },
  authorId: number,
) {
  const slug = data.slug || createSlug(data.title);

  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (existing) {
    throw new BlogError('Стаття з таким slug вже існує', 409);
  }

  if (data.categoryId) {
    const category = await prisma.blogCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new BlogError('Категорію блогу не знайдено', 404);
    }
  }

  const cleanContent = sanitizeHtml(data.content);
  const cleanExcerpt = data.excerpt ? sanitizeHtml(data.excerpt) : data.excerpt;

  // Auto-fill SEO fields so admins don't have to think about them; manual
  // values still win. Saved to DB (not just runtime fallback) so feeds/exports
  // and any third-party reader see the same string.
  const { seoTitle, seoDescription } = deriveSeoFallback(
    data.seoTitle,
    data.seoDescription,
    data.title,
    cleanExcerpt,
    cleanContent,
  );

  const cleanContentEn = data.contentEn ? sanitizeHtml(data.contentEn) : null;
  const cleanExcerptEn = data.excerptEn ? sanitizeHtml(data.excerptEn) : null;

  return prisma.blogPost.create({
    data: {
      title: data.title,
      slug,
      content: cleanContent,
      // Excerpt is plain-text-only on the storefront but the editor lets
      // managers paste HTML; sanitize so a <script> in the preview doesn't
      // make it into category listings.
      excerpt: cleanExcerpt,
      coverImage: data.coverImage,
      categoryId: data.categoryId,
      tags: data.tags ?? [],
      seoTitle,
      seoDescription,
      // EN translations — nullable; admin fills these from the EN tab in the form.
      titleEn: data.titleEn || null,
      excerptEn: cleanExcerptEn,
      contentEn: cleanContentEn,
      seoTitleEn: data.seoTitleEn || null,
      seoDescriptionEn: data.seoDescriptionEn || null,
      isPublished: data.isPublished ?? false,
      publishedAt: data.isPublished ? new Date() : null,
      authorId,
    },
    include: { category: true },
  });
}

export async function updatePost(
  id: number,
  data: {
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    coverImage?: string;
    categoryId?: number;
    tags?: string[];
    seoTitle?: string;
    seoDescription?: string;
    titleEn?: string;
    excerptEn?: string;
    contentEn?: string;
    seoTitleEn?: string;
    seoDescriptionEn?: string;
    isPublished?: boolean;
  },
) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new BlogError('Статтю не знайдено', 404);

  const slugChanged = !!(data.slug && data.slug !== post.slug);
  if (slugChanged && data.slug) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (existing) throw new BlogError('Стаття з таким slug вже існує', 409);

    // Record a 301-style redirect so the old URL keeps working (good for SEO
    // and any external links). Use upsert because the same oldSlug might have
    // been part of an earlier rename chain that's now being re-pointed.
    await prisma.slugRedirect.upsert({
      where: { oldSlug: post.slug },
      create: { oldSlug: post.slug, newSlug: data.slug, type: 'blog_post' },
      update: { newSlug: data.slug, type: 'blog_post' },
    });
  }

  if (data.categoryId) {
    const category = await prisma.blogCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new BlogError('Категорію блогу не знайдено', 404);
  }

  const publishedAt = data.isPublished === true && !post.isPublished ? new Date() : undefined;

  const cleanContent = data.content !== undefined ? sanitizeHtml(data.content) : undefined;
  const cleanExcerpt =
    data.excerpt !== undefined
      ? data.excerpt
        ? sanitizeHtml(data.excerpt)
        : data.excerpt
      : undefined;

  // Re-derive SEO fallback whenever the source fields (title/excerpt/content)
  // or the SEO fields themselves change. Treat empty string as "clear" — that
  // signals admin removed the override, so regenerate from the post body.
  let seoTitle: string | undefined;
  let seoDescription: string | undefined;
  const titleChanged = data.title !== undefined && data.title !== post.title;
  const contentChanged = cleanContent !== undefined && cleanContent !== post.content;
  const excerptChanged = cleanExcerpt !== undefined && cleanExcerpt !== post.excerpt;
  const seoTitleProvided = data.seoTitle !== undefined;
  const seoDescProvided = data.seoDescription !== undefined;

  if (seoTitleProvided || seoDescProvided || titleChanged || contentChanged || excerptChanged) {
    const effectiveTitle = data.title ?? post.title;
    const effectiveContent = cleanContent ?? post.content;
    const effectiveExcerpt =
      cleanExcerpt !== undefined ? cleanExcerpt : (post.excerpt ?? undefined);
    const incomingSeoTitle = seoTitleProvided ? data.seoTitle : (post.seoTitle ?? undefined);
    const incomingSeoDesc = seoDescProvided
      ? data.seoDescription
      : (post.seoDescription ?? undefined);
    const derived = deriveSeoFallback(
      incomingSeoTitle,
      incomingSeoDesc,
      effectiveTitle,
      effectiveExcerpt,
      effectiveContent,
    );
    seoTitle = derived.seoTitle;
    seoDescription = derived.seoDescription;
  }

  const cleanContentEn =
    data.contentEn !== undefined
      ? data.contentEn
        ? sanitizeHtml(data.contentEn)
        : null
      : undefined;
  const cleanExcerptEn =
    data.excerptEn !== undefined
      ? data.excerptEn
        ? sanitizeHtml(data.excerptEn)
        : null
      : undefined;

  return prisma.blogPost.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(cleanContent !== undefined && { content: cleanContent }),
      ...(cleanExcerpt !== undefined && { excerpt: cleanExcerpt }),
      ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(seoTitle !== undefined && { seoTitle }),
      ...(seoDescription !== undefined && { seoDescription }),
      // EN — admin can pass empty string to clear, undefined to keep current.
      ...(data.titleEn !== undefined && { titleEn: data.titleEn || null }),
      ...(cleanExcerptEn !== undefined && { excerptEn: cleanExcerptEn }),
      ...(cleanContentEn !== undefined && { contentEn: cleanContentEn }),
      ...(data.seoTitleEn !== undefined && { seoTitleEn: data.seoTitleEn || null }),
      ...(data.seoDescriptionEn !== undefined && {
        seoDescriptionEn: data.seoDescriptionEn || null,
      }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      ...(publishedAt !== undefined && { publishedAt }),
    },
    include: { category: true },
  });
}

export async function deletePost(id: number) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new BlogError('Статтю не знайдено', 404);

  // Soft-delete: mark with deletedAt + unpublish so the site stops serving it
  // immediately, but the row stays for audit / accidental-undo. List queries
  // filter `deletedAt: null` to hide it.
  await prisma.blogPost.update({
    where: { id },
    data: { deletedAt: new Date(), isPublished: false },
  });
}

export async function restorePost(id: number) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new BlogError('Статтю не знайдено', 404);
  if (!post.deletedAt) throw new BlogError('Стаття не є видаленою', 400);
  await prisma.blogPost.update({
    where: { id },
    data: { deletedAt: null },
  });
}

export async function getPublishedPosts(
  page: number,
  limit: number,
  categorySlug?: string,
  tag?: string,
) {
  const where: Record<string, unknown> = { isPublished: true, deletedAt: null };

  if (categorySlug) {
    const category = await prisma.blogCategory.findUnique({ where: { slug: categorySlug } });
    if (category) {
      where.categoryId = category.id;
    } else {
      return { posts: [], total: 0 };
    }
  }

  if (tag) {
    where.tags = { has: tag };
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return { posts, total };
}

export async function getPostBySlug(slug: string) {
  const post = await prisma.blogPost.findUnique({
    where: { slug, isPublished: true, deletedAt: null },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!post) return null;

  const updated = await prisma.blogPost.update({
    where: { id: post.id },
    data: { viewsCount: { increment: 1 } },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return updated;
}

export async function getRelatedPosts(postId: number, limit = 4) {
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    select: { tags: true, categoryId: true },
  });

  if (!post) return [];

  const conditions: Record<string, unknown>[] = [];

  if (post.tags.length > 0) {
    conditions.push({ tags: { hasSome: post.tags } });
  }

  if (post.categoryId) {
    conditions.push({ categoryId: post.categoryId });
  }

  if (conditions.length === 0) return [];

  return prisma.blogPost.findMany({
    where: {
      isPublished: true,
      deletedAt: null,
      id: { not: postId },
      OR: conditions,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

export async function getCategories() {
  return prisma.blogCategory.findMany({
    include: {
      _count: { select: { posts: { where: { isPublished: true } } } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

// Slugs that would collide with blog routing or admin paths. A category slug
// lands in /blog/<slug>-style URLs, so reserving these stops an admin from
// shadowing a real route (e.g. /blog/admin, /blog/new).
const RESERVED_BLOG_SLUGS = new Set([
  'admin',
  'api',
  'new',
  'edit',
  'create',
  'feed',
  'rss',
  'category',
  'tag',
  'search',
]);

export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  nameEn?: string;
  descriptionEn?: string;
  seoTitleEn?: string;
  seoDescriptionEn?: string;
}) {
  const slug = data.slug || createSlug(data.name);

  if (RESERVED_BLOG_SLUGS.has(slug)) {
    throw new BlogError('Цей slug зарезервовано системою', 422);
  }

  const existing = await prisma.blogCategory.findUnique({ where: { slug } });
  if (existing) {
    throw new BlogError('Категорія з таким slug вже існує', 409);
  }

  return prisma.blogCategory.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      nameEn: data.nameEn || null,
      descriptionEn: data.descriptionEn || null,
      seoTitleEn: data.seoTitleEn || null,
      seoDescriptionEn: data.seoDescriptionEn || null,
    },
  });
}

export async function updateCategory(
  id: number,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    nameEn?: string;
    descriptionEn?: string;
    seoTitleEn?: string;
    seoDescriptionEn?: string;
  },
) {
  const category = await prisma.blogCategory.findUnique({ where: { id } });
  if (!category) throw new BlogError('Категорію не знайдено', 404);

  if (data.slug && data.slug !== category.slug) {
    if (RESERVED_BLOG_SLUGS.has(data.slug)) {
      throw new BlogError('Цей slug зарезервовано системою', 422);
    }
    const existing = await prisma.blogCategory.findUnique({ where: { slug: data.slug } });
    if (existing) throw new BlogError('Категорія з таким slug вже існує', 409);
  }

  return prisma.blogCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
      ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
      ...(data.nameEn !== undefined && { nameEn: data.nameEn || null }),
      ...(data.descriptionEn !== undefined && { descriptionEn: data.descriptionEn || null }),
      ...(data.seoTitleEn !== undefined && { seoTitleEn: data.seoTitleEn || null }),
      ...(data.seoDescriptionEn !== undefined && {
        seoDescriptionEn: data.seoDescriptionEn || null,
      }),
    },
  });
}

export async function deleteCategory(id: number) {
  const category = await prisma.blogCategory.findUnique({
    where: { id },
    // Count only active posts — soft-deleted ones (deletedAt set) must not
    // forever block category deletion, consistent with the rest of this file.
    include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
  });

  if (!category) throw new BlogError('Категорію не знайдено', 404);

  if (category._count.posts > 0) {
    throw new BlogError('Неможливо видалити категорію з існуючими статтями', 400);
  }

  await prisma.blogCategory.delete({ where: { id } });
}
