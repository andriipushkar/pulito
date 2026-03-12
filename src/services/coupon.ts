import { prisma } from '@/lib/prisma';

export class CouponError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CouponError';
    this.statusCode = statusCode;
  }
}

export async function validateCoupon(code: string, userId?: number, orderAmount?: number) {
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
    throw new CouponError(`Мінімальна сума замовлення для цього промокоду: ${coupon.minOrderAmount} грн`);
  }

  return coupon;
}

export function calculateDiscount(coupon: { type: string; value: any; maxDiscount: any }, orderAmount: number): number {
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

export async function redeemCoupon(couponId: number, userId: number | null, orderId: number, discount: number) {
  await prisma.$transaction([
    prisma.couponRedemption.create({
      data: { couponId, userId, orderId, discount },
    }),
    prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    }),
  ]);
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
      createdBy: data.createdBy,
    },
  });
}

export async function updateCoupon(id: number, data: Partial<{
  description: string;
  isActive: boolean;
  usageLimit: number;
  usageLimitPerUser: number;
  maxDiscount: number;
  validFrom: string;
  validUntil: string;
}>) {
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
