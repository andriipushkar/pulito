import { prisma } from '@/lib/prisma';
import { percentOf, minMoney } from '@/utils/money';

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

  if (
    orderAmount !== undefined &&
    coupon.minOrderAmount &&
    orderAmount < Number(coupon.minOrderAmount)
  ) {
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
  } else if (coupon.applicableCategoryIds.length > 0 || coupon.excludedProductIds.length > 0) {
    // The coupon has product/category restrictions but the caller didn't
    // pass cart context — refuse rather than silently letting the discount
    // apply globally. Legacy clients that don't know about cart context
    // were previously bypassing these restrictions entirely.
    throw new CouponError(
      'Промокод має обмеження за товарами — оформіть замовлення через звичайний кошик, щоб перевірити умови',
      400,
    );
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
    // Defensive clamp: even if a legacy/imported coupon has value > 100,
    // we never produce a discount larger than the order amount itself.
    const pct = Math.min(Math.max(value, 0), 100);
    const discount = percentOf(orderAmount, pct);
    const max = coupon.maxDiscount ? Number(coupon.maxDiscount) : Infinity;
    // minMoney can't take Infinity (toCents(Infinity) → NaN); fold the optional cap in first.
    const capped = Number.isFinite(max) ? minMoney(discount, max) : discount;
    return minMoney(capped, orderAmount);
  }
  if (coupon.type === 'fixed_amount') {
    return minMoney(value, orderAmount);
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
      // Auto-disable when the increment brought us to the limit so a
      // depleted coupon stops eating validation cycles and shows as
      // inactive in the admin list immediately.
      await tx.coupon.updateMany({
        where: { id: couponId, usedCount: { gte: coupon.usageLimit }, isActive: true },
        data: { isActive: false },
      });
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
  // Up-front validation. Previously calculateDiscount silently clamped
  // percent>100 to 100, so an admin typo like `value: 1000` produced a
  // 100% discount that LOOKED right in the list but quietly handed out
  // free goods. Better to refuse at create time so the admin sees the
  // error immediately.
  if (data.type === 'percent' && (data.value < 0 || data.value > 100)) {
    throw new CouponError(`Відсоток знижки має бути 0–100 (отримано ${data.value})`, 400);
  }
  if (data.type === 'fixed_amount' && data.value < 0) {
    throw new CouponError("Фіксована сума знижки не може бути від'ємною", 400);
  }
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
