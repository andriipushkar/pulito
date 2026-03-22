import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';

export class BlogError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'BlogError';
  }
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
    isPublished?: boolean;
  },
  authorId: number
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

  return prisma.blogPost.create({
    data: {
      title: data.title,
      slug,
      content: data.content,
      excerpt: data.excerpt,
      coverImage: data.coverImage,
      categoryId: data.categoryId,
      tags: data.tags ?? [],
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
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
    isPublished?: boolean;
  }
) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new BlogError('Статтю не знайдено', 404);

  if (data.slug && data.slug !== post.slug) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (existing) throw new BlogError('Стаття з таким slug вже існує', 409);
  }

  if (data.categoryId) {
    const category = await prisma.blogCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new BlogError('Категорію блогу не знайдено', 404);
  }

  const publishedAt =
    data.isPublished === true && !post.isPublished ? new Date() : undefined;

  return prisma.blogPost.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
      ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
      ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      ...(publishedAt !== undefined && { publishedAt }),
    },
    include: { category: true },
  });
}

export async function deletePost(id: number) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new BlogError('Статтю не знайдено', 404);

  await prisma.blogPost.delete({ where: { id } });
}

export async function getPublishedPosts(
  page: number,
  limit: number,
  categorySlug?: string,
  tag?: string
) {
  const where: Record<string, unknown> = { isPublished: true };

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
    where: { slug, isPublished: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!post) return null;

  await prisma.blogPost.update({
    where: { id: post.id },
    data: { viewsCount: { increment: 1 } },
  });

  return post;
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

export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}) {
  const slug = data.slug || createSlug(data.name);

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
  }
) {
  const category = await prisma.blogCategory.findUnique({ where: { id } });
  if (!category) throw new BlogError('Категорію не знайдено', 404);

  if (data.slug && data.slug !== category.slug) {
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
    },
  });
}

export async function deleteCategory(id: number) {
  const category = await prisma.blogCategory.findUnique({
    where: { id },
    include: { _count: { select: { posts: true } } },
  });

  if (!category) throw new BlogError('Категорію не знайдено', 404);

  if (category._count.posts > 0) {
    throw new BlogError('Неможливо видалити категорію з існуючими статтями', 400);
  }

  await prisma.blogCategory.delete({ where: { id } });
}
