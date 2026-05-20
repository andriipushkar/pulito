import { prisma } from '@/lib/prisma';

export class CouponError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CouponError';
    this.statusCode = statusCode;
  }
}

export async function validateCoupon(
  code: string,
  userId?: number,
  orderAmount?: number,
  cartProductIds?: number[],
) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) {
    throw new CouponError('Промокод не знайдено або він неактивний');
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    throw new CouponError('Промокод ще не діє');
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    throw new CouponError('Промокод прострочений');
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponError('Промокод вичерпано');
  }

  if (userId && coupon.usageLimitPerUser) {
    const userUsages = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsages >= coupon.usageLimitPerUser) {
      throw new CouponError('Ви вже використали цей промокод максимальну кількість разів');
    }
  }

  if (orderAmount && coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
    throw new CouponError(
      `Мінімальна сума замовлення для цього промокоду: ${coupon.minOrderAmount} грн`,
    );
  }

  // Product/category restrictions. Logic:
  //   1. If `applicableCategoryIds` is non-empty, at least one cart product
  //      must belong to one of those categories.
  //   2. Products in `excludedProductIds` are not eligible (their presence
  //      doesn't invalidate the coupon, but they don't get the discount).
  //   3. If the cart consists entirely of excluded products → reject.
  if (cartProductIds && cartProductIds.length > 0) {
    const eligible = cartProductIds.filter((pid) => !coupon.excludedProductIds.includes(pid));
    if (eligible.length === 0) {
      throw new CouponError('Промокод не діє на товари у вашому кошику');
    }
    if (coupon.applicableCategoryIds.length > 0) {
      const matching = await prisma.product.count({
        where: {
          id: { in: eligible },
          categoryId: { in: coupon.applicableCategoryIds },
        },
      });
      if (matching === 0) {
        throw new CouponError(
          'Промокод діє лише на товари з певних категорій — нічого не знайдено у вашому кошику',
        );
      }
    }
  }

  return coupon;
}

export function calculateDiscount(
  coupon: {
    type: string;
    value: number | string | { toString(): string };
    maxDiscount: number | string | { toString(): string } | null;
  },
  orderAmount: number,
): number {
  const value = Number(coupon.value);
  if (coupon.type === 'percent') {
    const discount = (orderAmount * value) / 100;
    const max = coupon.maxDiscount ? Number(coupon.maxDiscount) : Infinity;
    return Math.min(discount, max);
  }
  if (coupon.type === 'fixed_amount') {
    return Math.min(value, orderAmount);
  }
  // free_delivery handled separately at checkout
  return 0;
}

export async function redeemCoupon(
  couponId: number,
  userId: number | null,
  orderId: number,
  discount: number,
) {
  // Atomic claim: only increment usedCount when it's strictly below usageLimit.
  // Two parallel checkouts can both pass the validateCoupon read but the
  // updateMany serialises here, so the second one with count === 0 must abort.
  await prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({
      where: { id: couponId },
      select: { usageLimit: true },
    });
    if (!coupon) throw new CouponError('Промокод не знайдено', 404);

    if (coupon.usageLimit != null) {
      const claimed = await tx.coupon.updateMany({
        where: { id: couponId, usedCount: { lt: coupon.usageLimit } },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count === 0) {
        throw new CouponError('Промокод вичерпано');
      }
    } else {
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    await tx.couponRedemption.create({
      data: { couponId, userId, orderId, discount },
    });
  });
}

export async function getCoupons(page = 1, limit = 20, showExpired = false) {
  const where = showExpired ? {} : { isActive: true };
  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coupon.count({ where }),
  ]);
  return { coupons, total };
}

export async function createCoupon(data: {
  code: string;
  description?: string;
  type: 'percent' | 'fixed_amount' | 'free_delivery';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  validFrom?: string;
  validUntil?: string;
  applicableCategoryIds?: number[];
  excludedProductIds?: number[];
  stackableWith?: string[];
  createdBy?: number;
}) {
  return prisma.coupon.create({
    data: {
      code: data.code.toUpperCase(),
      description: data.description,
      type: data.type,
      value: data.value,
      minOrderAmount: data.minOrderAmount,
      maxDiscount: data.maxDiscount,
      usageLimit: data.usageLimit,
      usageLimitPerUser: data.usageLimitPerUser,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      // These were validated in the API layer but previously dropped on the
      // floor — without them the category/product restrictions silently never
      // applied at checkout.
      applicableCategoryIds: data.applicableCategoryIds ?? [],
      excludedProductIds: data.excludedProductIds ?? [],
      stackableWith: data.stackableWith ?? [],
      createdBy: data.createdBy,
    },
  });
}

export async function updateCoupon(
  id: number,
  data: Partial<{
    description: string;
    isActive: boolean;
    usageLimit: number;
    usageLimitPerUser: number;
    maxDiscount: number;
    validFrom: string;
    validUntil: string;
  }>,
) {
  return prisma.coupon.update({
    where: { id },
    data: {
      ...data,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
    },
  });
}

export async function deleteCoupon(id: number) {
  return prisma.coupon.delete({ where: { id } });
}
