import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL } from '@/services/cache';

export interface CategoryListItem {
  id: number;
  name: string;
  slug: string;
  iconPath: string | null;
  coverImage: string | null;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  parentId: number | null;
  _count: { products: number };
}

export async function getCategories(options?: {
  includeHidden?: boolean;
}): Promise<CategoryListItem[]> {
  const cacheKey = `categories:list:${options?.includeHidden ? 'all' : 'visible'}`;
  const cached = await cacheGet<CategoryListItem[]>(cacheKey);
  if (cached) return cached;

  const where = options?.includeHidden ? {} : { isVisible: true };

  const result = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
  });

  await cacheSet(cacheKey, result, CACHE_TTL.LONG);
  return result;
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: {
        select: { name: true, slug: true },
      },
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
  });
}

export async function getCategoryById(id: number) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
  });
}

export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  iconPath?: string;
  coverImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder?: number;
  isVisible?: boolean;
  parentId?: number | null;
}) {
  const slug = data.slug || createSlug(data.name);

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    throw new CategoryError('Категорія з таким slug вже існує', 409);
  }

  // Limit parent categories to 8
  if (!data.parentId) {
    const parentCount = await prisma.category.count({ where: { parentId: null } });
    if (parentCount >= 8) {
      throw new CategoryError('Максимум 8 батьківських категорій. Створіть підкатегорію замість нової батьківської.', 400);
    }
  }

  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw new CategoryError('Батьківська категорія не знайдена', 404);
    }
  }

  const created = await prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      iconPath: data.iconPath,
      coverImage: data.coverImage,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      sortOrder: data.sortOrder ?? 0,
      isVisible: data.isVisible ?? true,
      parentId: data.parentId ?? null,
    },
    include: {
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
  });
  await cacheInvalidate('categories:*');
  return created;
}

export async function updateCategory(
  id: number,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    iconPath?: string;
    coverImage?: string;
    seoTitle?: string;
    seoDescription?: string;
    sortOrder?: number;
    isVisible?: boolean;
    parentId?: number | null;
  }
) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new CategoryError('Категорію не знайдено', 404);
  }

  let slug = data.slug;
  if (data.name && !data.slug) {
    slug = createSlug(data.name);
  }

  if (slug && slug !== category.slug) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new CategoryError('Категорія з таким slug вже існує', 409);
    }

    // Auto-create redirect from old slug to new slug
    await prisma.slugRedirect.upsert({
      where: { oldSlug: category.slug },
      update: { newSlug: slug, type: 'category' },
      create: { oldSlug: category.slug, newSlug: slug, type: 'category' },
    });
  }

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      throw new CategoryError('Категорія не може бути своїм батьком', 400);
    }
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw new CategoryError('Батьківська категорія не знайдена', 404);
    }
  }

  // Prevent making a child into a parent if limit reached
  if (data.parentId === null && category.parentId !== null) {
    const parentCount = await prisma.category.count({ where: { parentId: null } });
    if (parentCount >= 8) {
      throw new CategoryError('Максимум 8 батьківських категорій. Неможливо перенести на верхній рівень.', 400);
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(slug !== undefined && { slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.iconPath !== undefined && { iconPath: data.iconPath }),
      ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
      ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
      ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
    },
    include: {
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
  });
  await cacheInvalidate('categories:*');
  return updated;
}

export async function deleteCategory(id: number) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!category) {
    throw new CategoryError('Категорію не знайдено', 404);
  }

  if (category._count.products > 0) {
    throw new CategoryError(
      `Неможливо видалити категорію з ${category._count.products} товарами. Спочатку перенесіть товари.`,
      400
    );
  }

  await prisma.category.delete({ where: { id } });
  await cacheInvalidate('categories:*');
}

export class CategoryError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}
