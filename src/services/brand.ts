import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { cacheInvalidate } from '@/services/cache';

// Brand changes affect product listings (filter chips, brand column,
// detail page badge, /brand/[slug] etc.) — every write path should
// invalidate the products cache and the brand listing cache.
async function invalidateBrandCaches() {
  await Promise.all([cacheInvalidate('products:*'), cacheInvalidate('brands:*')]);
}

export class BrandError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'BrandError';
  }
}

export async function getBrands(options?: { includeHidden?: boolean }) {
  const where: Prisma.BrandWhereInput = { deletedAt: null };
  if (!options?.includeHidden) where.isVisible = true;
  return prisma.brand.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Brands shown in the catalog filter sidebar. Returns every visible brand
 * with its active-product count, so the user sees "Ariel (12)" even before
 * any products are linked — the filter UI is then available immediately
 * after creating brands, instead of staying hidden until at least one
 * product gets a brand assigned.
 *
 * If you want to hide truly empty brands, filter `count > 0` on the
 * caller — the sidebar currently displays all so the operator notices
 * unused brands and links them.
 */
export async function getBrandsForCatalog(): Promise<
  Array<{ slug: string; name: string; count: number }>
> {
  const brands = await prisma.brand.findMany({
    where: { deletedAt: null, isVisible: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
  return brands.map((b) => ({ slug: b.slug, name: b.name, count: b._count.products }));
}

export async function getBrandById(id: number) {
  return prisma.brand.findFirst({ where: { id, deletedAt: null } });
}

export async function getBrandBySlug(slug: string) {
  return prisma.brand.findFirst({
    where: { slug, deletedAt: null, isVisible: true },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
}

export async function createBrand(data: {
  name: string;
  slug?: string;
  description?: string | null;
  logoPath?: string | null;
  isVisible?: boolean;
  sortOrder?: number;
}) {
  const slug = data.slug || createSlug(data.name);

  // Resurrect a soft-deleted brand with the same slug instead of failing —
  // identical pattern to categories (the unique index would otherwise burn
  // the slug permanently for a deleted-and-forgotten brand).
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing?.deletedAt) {
    const revived = await prisma.brand.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description ?? null,
        logoPath: data.logoPath ?? null,
        isVisible: data.isVisible ?? true,
        sortOrder: data.sortOrder ?? 0,
        deletedAt: null,
      },
    });
    await invalidateBrandCaches();
    return revived;
  }
  if (existing) {
    throw new BrandError(`Виробник з slug "${slug}" вже існує`, 409);
  }

  // Also guard against a name collision (separate unique index on name).
  const nameClash = await prisma.brand.findUnique({ where: { name: data.name } });
  if (nameClash?.deletedAt) {
    const revived = await prisma.brand.update({
      where: { id: nameClash.id },
      data: {
        slug,
        description: data.description ?? null,
        logoPath: data.logoPath ?? null,
        isVisible: data.isVisible ?? true,
        sortOrder: data.sortOrder ?? 0,
        deletedAt: null,
      },
    });
    await invalidateBrandCaches();
    return revived;
  }
  if (nameClash) {
    throw new BrandError(`Виробник з назвою "${data.name}" вже існує`, 409);
  }

  const created = await prisma.brand.create({
    data: {
      name: data.name,
      slug,
      description: data.description ?? null,
      logoPath: data.logoPath ?? null,
      isVisible: data.isVisible ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await invalidateBrandCaches();
  return created;
}

export async function updateBrand(
  id: number,
  data: {
    name?: string;
    slug?: string;
    description?: string | null;
    logoPath?: string | null;
    isVisible?: boolean;
    sortOrder?: number;
  },
) {
  const brand = await prisma.brand.findFirst({ where: { id, deletedAt: null } });
  if (!brand) throw new BrandError('Виробника не знайдено', 404);

  const clientSentExplicitSlug =
    data.slug !== undefined && data.slug !== null && data.slug !== '' && data.slug !== brand.slug;

  let resolvedSlug: string | undefined;
  if (clientSentExplicitSlug) {
    resolvedSlug = data.slug!;
  } else if (data.name && data.name !== brand.name) {
    resolvedSlug = createSlug(data.name);
  }

  if (resolvedSlug && resolvedSlug !== brand.slug) {
    const slugClash = await prisma.brand.findFirst({
      where: { slug: resolvedSlug, id: { not: id } },
    });
    if (slugClash) throw new BrandError(`Виробник з slug "${resolvedSlug}" вже існує`, 409);
  }

  const updated = await prisma.brand.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(resolvedSlug && { slug: resolvedSlug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.logoPath !== undefined && { logoPath: data.logoPath }),
      ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });
  await invalidateBrandCaches();
  return updated;
}

export async function deleteBrand(id: number): Promise<{ hard: boolean }> {
  const brand = await prisma.brand.findFirst({ where: { id, deletedAt: null } });
  if (!brand) throw new BrandError('Виробника не знайдено', 404);

  // Try hard delete; FK on products is ON DELETE SET NULL, so this only
  // fails if some other table without SET NULL references the brand.
  try {
    await prisma.brand.delete({ where: { id } });
    await invalidateBrandCaches();
    return { hard: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      await prisma.brand.update({
        where: { id },
        data: { deletedAt: new Date(), isVisible: false },
      });
      await invalidateBrandCaches();
      return { hard: false };
    }
    throw err;
  }
}
