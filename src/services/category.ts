import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL } from '@/services/cache';

// Soft-cap for top-level categories. Stored in SiteSetting so admins can
// raise it without redeploying. Default 8 keeps the storefront mega-menu
// readable; values past ~12 typically need a redesign.
const DEFAULT_MAX_ROOT_CATEGORIES = 8;
async function getMaxRootCategories(): Promise<number> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: 'max_root_categories' },
      select: { value: true },
    });
    const n = Number(row?.value);
    return Number.isFinite(n) && n >= 1 && n <= 50 ? n : DEFAULT_MAX_ROOT_CATEGORIES;
  } catch {
    return DEFAULT_MAX_ROOT_CATEGORIES;
  }
}

export interface CategoryListItem {
  id: number;
  name: string;
  slug: string;
  iconPath: string | null;
  coverImage: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
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

  const where = options?.includeHidden ? { deletedAt: null } : { isVisible: true, deletedAt: null };

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
  description?: string | null;
  iconPath?: string | null;
  coverImage?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  parentId?: number | null;
}) {
  const slug = data.slug || createSlug(data.name);
  const isTopLevel = !data.parentId;

  // Parent must exist AND not be soft-deleted.
  if (data.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: data.parentId, deletedAt: null },
    });
    if (!parent) {
      throw new CategoryError('Батьківська категорія не знайдена', 404);
    }
  }

  const existing = await prisma.category.findUnique({ where: { slug } });

  // Resurrect a soft-deleted category that occupies this slug instead of
  // failing with "вже існує". Without this, deleting a category permanently
  // burns its slug — the unique index keeps the row around, but admin UI
  // (which filters deletedAt) doesn't show it, so the operator just sees
  // an unexplained 409.
  if (existing?.deletedAt) {
    if (isTopLevel) {
      const activeTopLevel = await prisma.category.count({
        where: { parentId: null, deletedAt: null, id: { not: existing.id } },
      });
      const maxRoots = await getMaxRootCategories();
      if (activeTopLevel >= maxRoots) {
        throw new CategoryError(
          `Максимум ${maxRoots} батьківських категорій. Створіть підкатегорію замість нової батьківської.`,
          400,
        );
      }
    }
    const revived = await prisma.category.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description ?? null,
        iconPath: data.iconPath ?? null,
        coverImage: data.coverImage ?? null,
        seoTitle: data.seoTitle ?? null,
        seoDescription: data.seoDescription ?? null,
        sortOrder: data.sortOrder ?? 0,
        isVisible: data.isVisible ?? true,
        parentId: data.parentId ?? null,
        deletedAt: null,
      },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });
    await cacheInvalidate('categories:*');
    return revived;
  }

  if (existing) {
    // Reached only when the existing row is ACTIVE (soft-deleted is handled
    // above by resurrect). Include the conflicting slug + name in the error
    // so the admin can tell which existing category is in the way.
    throw new CategoryError(
      `Категорія з slug "${slug}" вже існує (id=${existing.id}, "${existing.name}")`,
      409,
    );
  }

  // Limit top-level categories — count only active ones so deleted
  // categories don't permanently take up a slot. Soft-cap is configurable
  // via SiteSetting `max_root_categories` (defaults to 8).
  // Advisory lock serialises the count+insert against parallel POSTs so
  // two admins clicking "create" at the same time can't both bypass the cap.
  // pg_try_advisory_lock (returns bool) is used instead of pg_advisory_lock
  // (returns void) because the pg driver adapter rejects void-typed columns.
  const CATEGORY_CREATE_LOCK_NS = 0x43415400;
  if (isTopLevel) {
    const lockRows = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(${CATEGORY_CREATE_LOCK_NS}::int) AS ok
    `;
    if (!lockRows[0]?.ok) {
      throw new CategoryError(
        'Інший адміністратор саме створює категорію. Спробуйте за кілька секунд.',
        409,
      );
    }
    const parentCount = await prisma.category.count({
      where: { parentId: null, deletedAt: null },
    });
    const maxRoots = await getMaxRootCategories();
    if (parentCount >= maxRoots) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${CATEGORY_CREATE_LOCK_NS}::int)`.catch(
        () => null,
      );
      throw new CategoryError(
        `Максимум ${maxRoots} батьківських категорій. Створіть підкатегорію замість нової батьківської.`,
        400,
      );
    }
  }

  let created;
  try {
    created = await prisma.category.create({
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
  } finally {
    if (isTopLevel) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${CATEGORY_CREATE_LOCK_NS}::int)`.catch(
        () => null,
      );
    }
  }
  await cacheInvalidate('categories:*');
  return created;
}

export async function updateCategory(
  id: number,
  data: {
    name?: string;
    slug?: string;
    description?: string | null;
    iconPath?: string | null;
    coverImage?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    sortOrder?: number;
    isVisible?: boolean;
    parentId?: number | null;
    // Optimistic concurrency token; see updateBrand for the contract.
    version?: number;
  },
) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new CategoryError('Категорію не знайдено', 404);
  }

  // If the client just echoed back the current slug (e.g. the edit form
  // pre-fills it on load and the user only edited `name`), treat it as
  // "not provided" so we can regenerate from the new name. An explicit
  // override is detected by data.slug being different from the stored one.
  const clientSentExplicitSlug =
    data.slug !== undefined &&
    data.slug !== null &&
    data.slug !== '' &&
    data.slug !== category.slug;

  let slug: string | undefined;
  if (clientSentExplicitSlug) {
    slug = data.slug;
  } else if (data.name && data.name !== category.name) {
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

  // Prevent making a child into a parent if limit reached. Filter out
  // soft-deleted categories so their tombstones don't keep the cap pinned.
  if (data.parentId === null && category.parentId !== null) {
    const parentCount = await prisma.category.count({
      where: { parentId: null, deletedAt: null },
    });
    const maxRoots = await getMaxRootCategories();
    if (parentCount >= maxRoots) {
      throw new CategoryError(
        `Максимум ${maxRoots} батьківських категорій. Неможливо перенести на верхній рівень.`,
        400,
      );
    }
  }

  const baseData = {
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
    version: { increment: 1 },
  };

  // Optimistic concurrency. See updateBrand for the same pattern.
  if (data.version !== undefined) {
    const result = await prisma.category.updateMany({
      where: { id, version: data.version },
      data: baseData,
    });
    if (result.count === 0) {
      throw new CategoryError(
        'Категорія була змінена іншим адміністратором. Оновіть сторінку і повторіть.',
        409,
      );
    }
    const refreshed = await prisma.category.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });
    await cacheInvalidate('categories:*');
    return refreshed;
  }

  const updated = await prisma.category.update({
    where: { id },
    data: baseData,
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
      400,
    );
  }

  // Soft delete — preserve for historical order references
  await prisma.category.update({
    where: { id },
    data: { deletedAt: new Date(), isVisible: false },
  });
  await cacheInvalidate('categories:*');
}

export class CategoryError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}
