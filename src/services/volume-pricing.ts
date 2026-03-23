import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import type { CreateVolumeDiscountInput, UpdateVolumeDiscountInput } from '@/validators/volume-discount';

export class VolumePricingError extends Error {
  constructor(
    message: string,
    public statusCode: number
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
  quantity: number
): Promise<{ discountPercent: number; discountType: string } | null> {
  const now = new Date();

  const baseWhere = {
    isActive: true,
    minQuantity: { lte: quantity },
    OR: [
      { maxQuantity: null },
      { maxQuantity: { gte: quantity } },
    ],
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };

  // Product-specific discount first
  const productDiscount = await prisma.volumeDiscount.findFirst({
    where: {
      ...baseWhere,
      productId,
    },
    orderBy: [{ priority: 'desc' }, { discountPercent: 'desc' }],
  });

  if (productDiscount) {
    return {
      discountPercent: productDiscount.discountPercent,
      discountType: productDiscount.discountType,
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
        discountPercent: categoryDiscount.discountPercent,
        discountType: categoryDiscount.discountType,
      };
    }
  }

  return null;
}

/**
 * Apply volume discounts to cart items, returns items with adjusted prices.
 */
export async function applyVolumeDiscounts(
  cartItems: Array<{ productId: number; categoryId: number | null; quantity: number; price: number }>
): Promise<Array<{ productId: number; originalPrice: number; discountedPrice: number; discountPercent: number; quantity: number }>> {
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
      };
    })
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
      OR: [
        { productId },
        ...(categoryId ? [{ categoryId, productId: null }] : []),
      ],
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

export async function createVolumeDiscount(data: CreateVolumeDiscountInput) {
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
    },
    include: volumeDiscountInclude,
  });
}

export async function updateVolumeDiscount(id: number, data: UpdateVolumeDiscountInput) {
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
      maxQuantity: data.maxQuantity !== undefined ? (data.maxQuantity ?? null) : existing.maxQuantity,
      discountPercent: data.discountPercent ?? existing.discountPercent,
      discountType: data.discountType ?? existing.discountType,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      priority: data.priority ?? existing.priority,
      startsAt: data.startsAt !== undefined ? (data.startsAt ? new Date(data.startsAt) : null) : existing.startsAt,
      endsAt: data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : existing.endsAt,
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
