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

export async function getBrands(options?: {
  includeHidden?: boolean;
  includeProductCount?: boolean;
}) {
  const where: Prisma.BrandWhereInput = { deletedAt: null };
  if (!options?.includeHidden) where.isVisible = true;
  return prisma.brand.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    ...(options?.includeProductCount
      ? { include: { _count: { select: { products: { where: { isActive: true } } } } } }
      : {}),
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

interface BrandWritable {
  name?: string;
  slug?: string;
  description?: string | null;
  logoPath?: string | null;
  website?: string | null;
  country?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isVisible?: boolean;
  sortOrder?: number;
  // Optimistic concurrency: when provided, PUT only succeeds if the row's
  // current version matches; otherwise BrandError(409) is thrown.
  version?: number;
}

function pickOptionalFields(data: BrandWritable) {
  // Treat empty website strings as null (form submits "" for cleared fields).
  const w = data.website === '' ? null : data.website;
  return {
    ...(data.description !== undefined && { description: data.description }),
    ...(data.logoPath !== undefined && { logoPath: data.logoPath }),
    ...(w !== undefined && { website: w }),
    ...(data.country !== undefined && { country: data.country }),
    ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
    ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
    ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
    ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
  };
}

export async function createBrand(data: BrandWritable & { name: string }) {
  const slug = data.slug || createSlug(data.name);
  const optional = pickOptionalFields(data);

  // Resurrect a soft-deleted brand with the same slug instead of failing —
  // identical pattern to categories (the unique index would otherwise burn
  // the slug permanently for a deleted-and-forgotten brand).
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing?.deletedAt) {
    const revived = await prisma.brand.update({
      where: { id: existing.id },
      data: { name: data.name, ...optional, deletedAt: null },
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
      data: { slug, ...optional, deletedAt: null },
    });
    await invalidateBrandCaches();
    return revived;
  }
  if (nameClash) {
    throw new BrandError(`Виробник з назвою "${data.name}" вже існує`, 409);
  }

  const created = await prisma.brand.create({
    data: { name: data.name, slug, ...optional },
  });
  await invalidateBrandCaches();
  return created;
}

export async function updateBrand(id: number, data: BrandWritable) {
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

  // Optimistic concurrency: client must send the version it read. updateMany
  // returns count=0 if the version no longer matches → another admin edited
  // in the meantime. Bump version atomically on success.
  if (data.version !== undefined) {
    const result = await prisma.brand.updateMany({
      where: { id, version: data.version },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(resolvedSlug && { slug: resolvedSlug }),
        ...pickOptionalFields(data),
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new BrandError(
        'Виробник був змінений іншим адміністратором. Оновіть сторінку і повторіть.',
        409,
      );
    }
    const refreshed = await prisma.brand.findUniqueOrThrow({ where: { id } });
    await invalidateBrandCaches();
    return refreshed;
  }

  const updated = await prisma.brand.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(resolvedSlug && { slug: resolvedSlug }),
      ...pickOptionalFields(data),
      version: { increment: 1 },
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
