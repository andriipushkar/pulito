import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import type {
  CreateVolumeDiscountInput,
  UpdateVolumeDiscountInput,
} from '@/validators/volume-discount';

export class VolumePricingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'VolumePricingError';
  }
}

/**
 * Find best matching volume discount for a product/category at given quantity.
 * Product-specific discounts take precedence over category-wide.
 * Higher priority value wins within same scope.
 * Only active discounts within date range are considered.
 */
export async function getVolumeDiscount(
  productId: number,
  categoryId: number | null,
  quantity: number,
): Promise<{ discountPercent: number; discountType: string; stackableWith: string[] } | null> {
  const now = new Date();

  const baseWhere = {
    isActive: true,
    minQuantity: { lte: quantity },
    OR: [{ maxQuantity: null }, { maxQuantity: { gte: quantity } }],
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };

  // Product-specific discount first. Order: highest priority wins; among
  // discounts of equal priority pick the largest % (best for the customer).
  // Example: 5–10 шт=5% vs 10–15 шт=15% — at qty=10 both qualify, the 15%
  // one wins because discountPercent desc comes after priority desc.
  const productDiscount = await prisma.volumeDiscount.findFirst({
    where: {
      ...baseWhere,
      productId,
    },
    orderBy: [{ priority: 'desc' }, { discountPercent: 'desc' }],
  });

  if (productDiscount) {
    return {
      // Decimal column lands as a Prisma.Decimal object — coerce to number for
      // the price-math callers downstream. Was a Float before; same return
      // type is preserved so callers keep working unchanged.
      discountPercent: Number(productDiscount.discountPercent),
      discountType: productDiscount.discountType,
      stackableWith: productDiscount.stackableWith ?? [],
    };
  }

  // Category-level discount
  if (categoryId) {
    const categoryDiscount = await prisma.volumeDiscount.findFirst({
      where: {
        ...baseWhere,
        categoryId,
        productId: null,
      },
      orderBy: [{ priority: 'desc' }, { discountPercent: 'desc' }],
    });

    if (categoryDiscount) {
      return {
        discountPercent: Number(categoryDiscount.discountPercent),
        discountType: categoryDiscount.discountType,
        stackableWith: categoryDiscount.stackableWith ?? [],
      };
    }
  }

  return null;
}

/**
 * Apply volume discounts to cart items, returns items with adjusted prices.
 */
export async function applyVolumeDiscounts(
  cartItems: Array<{
    productId: number;
    categoryId: number | null;
    quantity: number;
    price: number;
  }>,
): Promise<
  Array<{
    productId: number;
    originalPrice: number;
    discountedPrice: number;
    discountPercent: number;
    quantity: number;
    stackableWith: string[];
  }>
> {
  return Promise.all(
    cartItems.map(async (item) => {
      const discount = await getVolumeDiscount(item.productId, item.categoryId, item.quantity);

      if (!discount) {
        return {
          productId: item.productId,
          originalPrice: item.price,
          discountedPrice: item.price,
          discountPercent: 0,
          quantity: item.quantity,
          stackableWith: [],
        };
      }

      let discountedPrice: number;
      if (discount.discountType === 'fixed_amount') {
        discountedPrice = Math.max(0, item.price - discount.discountPercent);
      } else {
        discountedPrice = Math.round(item.price * (1 - discount.discountPercent / 100) * 100) / 100;
      }

      return {
        productId: item.productId,
        originalPrice: item.price,
        discountedPrice,
        discountPercent: discount.discountPercent,
        quantity: item.quantity,
        stackableWith: discount.stackableWith,
      };
    }),
  );
}

/**
 * Get volume discounts for a specific product (for display on product cards).
 */
export async function getVolumeDiscountsForProduct(productId: number, categoryId: number | null) {
  const now = new Date();

  const discounts = await prisma.volumeDiscount.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
      OR: [{ productId }, ...(categoryId ? [{ categoryId, productId: null }] : [])],
    },
    orderBy: [{ minQuantity: 'asc' }],
  });

  return discounts;
}

// ─── Admin CRUD ──────────────────────

const volumeDiscountInclude = {
  product: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.VolumeDiscountInclude;

export async function getVolumeDiscounts(filters?: {
  productId?: number;
  categoryId?: number;
  isActive?: boolean;
}) {
  const where: Prisma.VolumeDiscountWhereInput = {};

  if (filters?.productId) where.productId = filters.productId;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  return prisma.volumeDiscount.findMany({
    where,
    include: volumeDiscountInclude,
    orderBy: [{ priority: 'desc' }, { minQuantity: 'asc' }],
  });
}

export async function createVolumeDiscount(
  data: CreateVolumeDiscountInput & { stackableWith?: string[] },
) {
  // Overlap detection: refuse to create a discount whose [minQuantity, maxQuantity]
  // range intersects any existing active range for the same product or
  // category. Two overlapping rules tie on qty=N would have getVolumeDiscount
  // arbitrarily pick by priority+discountPercent order — the customer
  // sees the highest matching discount, but the admin never realised they
  // wrote conflicting rules. Catch at create time so the conflict is loud.
  const minQ = data.minQuantity;
  const maxQ = data.maxQuantity ?? Number.MAX_SAFE_INTEGER;
  const scopeFilter = data.productId
    ? { productId: data.productId }
    : { categoryId: data.categoryId ?? null, productId: null };
  const candidates = await prisma.volumeDiscount.findMany({
    where: { isActive: true, ...scopeFilter },
    select: { id: true, minQuantity: true, maxQuantity: true },
  });
  const conflict = candidates.find((c) => {
    const cMin = c.minQuantity;
    const cMax = c.maxQuantity ?? Number.MAX_SAFE_INTEGER;
    return minQ <= cMax && maxQ >= cMin;
  });
  if (conflict) {
    throw new VolumePricingError(
      `Діапазон [${minQ}-${data.maxQuantity ?? '∞'}] перетинається з існуючим правилом id=${conflict.id} ([${conflict.minQuantity}-${conflict.maxQuantity ?? '∞'}])`,
      409,
    );
  }

  return prisma.volumeDiscount.create({
    data: {
      productId: data.productId ?? null,
      categoryId: data.categoryId ?? null,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity ?? null,
      discountPercent: data.discountPercent,
      discountType: data.discountType ?? 'percentage',
      isActive: data.isActive ?? true,
      priority: data.priority ?? 0,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      // Persist stacking rule — without this, the rule defaulted to "[]" and
      // never stacked with anything, regardless of admin's intent.
      stackableWith: data.stackableWith ?? [],
    },
    include: volumeDiscountInclude,
  });
}

/**
 * Bulk-create volume discounts (CSV/spreadsheet import). Creates sequentially
 * rather than in one transaction so a single bad row (e.g. range overlap)
 * doesn't roll back the whole import — each row succeeds or fails on its own
 * and the caller gets a per-row report. Sequential order also means the
 * overlap check in createVolumeDiscount sees rows created earlier in the same
 * batch, so internally-conflicting imports are caught too.
 */
export async function createVolumeDiscountsBulk(
  items: (CreateVolumeDiscountInput & { stackableWith?: string[] })[],
): Promise<{
  created: number;
  failed: number;
  results: Array<{ index: number; ok: boolean; id?: number; error?: string }>;
}> {
  const results: Array<{ index: number; ok: boolean; id?: number; error?: string }> = [];
  let created = 0;
  for (let i = 0; i < items.length; i++) {
    try {
      const item = await createVolumeDiscount(items[i]);
      created++;
      results.push({ index: i, ok: true, id: item.id });
    } catch (err) {
      const error = err instanceof VolumePricingError ? err.message : 'Помилка створення';
      results.push({ index: i, ok: false, error });
    }
  }
  return { created, failed: results.length - created, results };
}

export async function updateVolumeDiscount(
  id: number,
  data: UpdateVolumeDiscountInput & { stackableWith?: string[] },
) {
  const existing = await prisma.volumeDiscount.findUnique({ where: { id } });
  if (!existing) {
    throw new VolumePricingError('Знижку за обсяг не знайдено', 404);
  }

  return prisma.volumeDiscount.update({
    where: { id },
    data: {
      productId: data.productId !== undefined ? (data.productId ?? null) : existing.productId,
      categoryId: data.categoryId !== undefined ? (data.categoryId ?? null) : existing.categoryId,
      minQuantity: data.minQuantity ?? existing.minQuantity,
      maxQuantity:
        data.maxQuantity !== undefined ? (data.maxQuantity ?? null) : existing.maxQuantity,
      discountPercent: data.discountPercent ?? existing.discountPercent,
      discountType: data.discountType ?? existing.discountType,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      priority: data.priority ?? existing.priority,
      startsAt:
        data.startsAt !== undefined
          ? data.startsAt
            ? new Date(data.startsAt)
            : null
          : existing.startsAt,
      endsAt:
        data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : existing.endsAt,
      ...(data.stackableWith !== undefined && { stackableWith: data.stackableWith }),
    },
    include: volumeDiscountInclude,
  });
}

export async function deleteVolumeDiscount(id: number) {
  const existing = await prisma.volumeDiscount.findUnique({ where: { id } });
  if (!existing) {
    throw new VolumePricingError('Знижку за обсяг не знайдено', 404);
  }

  await prisma.volumeDiscount.delete({ where: { id } });
}
