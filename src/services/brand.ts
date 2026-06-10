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
  page?: number;
  limit?: number;
}) {
  const where: Prisma.BrandWhereInput = { deletedAt: null };
  if (!options?.includeHidden) where.isVisible = true;

  // Pagination — earlier always returned every brand which started to lag
  // the admin UI past ~150 rows (each row pulls _count.products). Cap at
  // 200, default 50 so the UI gets a responsive first page.
  const page = options?.page ? Math.max(1, options.page) : undefined;
  const limit = options?.limit ? Math.min(200, Math.max(1, options.limit)) : undefined;

  return prisma.brand.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    ...(options?.includeProductCount
      ? { include: { _count: { select: { products: { where: { isActive: true } } } } } }
      : {}),
    ...(page !== undefined && limit !== undefined ? { skip: (page - 1) * limit, take: limit } : {}),
  });
}

export async function countBrands(options?: { includeHidden?: boolean }) {
  const where: Prisma.BrandWhereInput = { deletedAt: null };
  if (!options?.includeHidden) where.isVisible = true;
  return prisma.brand.count({ where });
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

/**
 * Brands for the homepage "brands" block: visible, with at least one active
 * product, logo/name/slug only. Empty brands are hidden here (unlike the
 * catalog sidebar) — a homepage tile that leads to an empty listing is noise.
 */
export async function getBrandsForHomepage(
  limit = 12,
): Promise<Array<{ slug: string; name: string; logoPath: string | null }>> {
  return prisma.brand.findMany({
    where: {
      deletedAt: null,
      isVisible: true,
      products: { some: { isActive: true, deletedAt: null } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: limit,
    select: { slug: true, name: true, logoPath: true },
  });
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
  nameEn?: string | null;
  descriptionEn?: string | null;
  seoTitleEn?: string | null;
  seoDescriptionEn?: string | null;
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
    ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
    ...(data.descriptionEn !== undefined && { descriptionEn: data.descriptionEn }),
    ...(data.seoTitleEn !== undefined && { seoTitleEn: data.seoTitleEn }),
    ...(data.seoDescriptionEn !== undefined && { seoDescriptionEn: data.seoDescriptionEn }),
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
    throw new BrandError(`Торгова марка з slug "${slug}" вже існує`, 409);
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
    throw new BrandError(`Торгова марка з назвою "${data.name}" вже існує`, 409);
  }

  const created = await prisma.brand.create({
    data: { name: data.name, slug, ...optional },
  });
  await invalidateBrandCaches();
  return created;
}

export async function updateBrand(id: number, data: BrandWritable) {
  const brand = await prisma.brand.findFirst({ where: { id, deletedAt: null } });
  if (!brand) throw new BrandError('Торгової марки не знайдено', 404);

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
    if (slugClash) throw new BrandError(`Торгова марка з slug "${resolvedSlug}" вже існує`, 409);
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
        'Торгова марка був змінений іншим адміністратором. Оновіть сторінку і повторіть.',
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

export async function deleteBrand(id: number): Promise<{
  hard: boolean;
  affectedProducts: number;
}> {
  const brand = await prisma.brand.findFirst({ where: { id, deletedAt: null } });
  if (!brand) throw new BrandError('Торгової марки не знайдено', 404);

  // Snapshot count of active products that will lose their brand link via
  // `ON DELETE SET NULL`. Without this the operator deletes "Ariel" and
  // doesn't realise 200 products silently lost their brand badge.
  const affectedProducts = await prisma.product.count({
    where: { brandId: id, deletedAt: null },
  });

  // Try hard delete; FK on products is ON DELETE SET NULL, so this only
  // fails if some other table without SET NULL references the brand.
  try {
    await prisma.brand.delete({ where: { id } });
    await invalidateBrandCaches();
    return { hard: true, affectedProducts };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      await prisma.brand.update({
        where: { id },
        data: { deletedAt: new Date(), isVisible: false },
      });
      await invalidateBrandCaches();
      return { hard: false, affectedProducts };
    }
    throw err;
  }
}
