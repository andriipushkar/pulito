import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    coupon: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    couponRedemption: {
      create: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import {
  validateCoupon,
  calculateDiscount,
  redeemCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  CouponError,
} from '@/services/coupon';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCoupon = (overrides?: Record<string, unknown>) => ({
  id: 1,
  code: 'SAVE10',
  isActive: true,
  type: 'percent',
  value: 10,
  minOrderAmount: null,
  maxDiscount: null,
  usageLimit: null,
  usageLimitPerUser: null,
  usedCount: 0,
  validFrom: null,
  validUntil: null,
  createdAt: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// validateCoupon
// ---------------------------------------------------------------------------

describe('validateCoupon', () => {
  it('returns coupon when valid', async () => {
    const coupon = makeCoupon();
    mockPrisma.coupon.findUnique.mockResolvedValue(coupon);

    const result = await validateCoupon('save10');
    expect(result).toEqual(coupon);
    expect(mockPrisma.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'SAVE10' } });
  });

  it('throws when coupon not found', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(null);

    await expect(validateCoupon('NOPE')).rejects.toThrow(CouponError);
    await expect(validateCoupon('NOPE')).rejects.toThrow('не знайдено');
  });

  it('throws when coupon is inactive', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(makeCoupon({ isActive: false }));

    await expect(validateCoupon('SAVE10')).rejects.toThrow(CouponError);
  });

  it('throws when coupon is not yet active (validFrom in the future)', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    mockPrisma.coupon.findUnique.mockResolvedValue(makeCoupon({ validFrom: future }));

    await expect(validateCoupon('SAVE10')).rejects.toThrow('ще не діє');
  });

  it('throws when coupon is expired', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockPrisma.coupon.findUnique.mockResolvedValue(makeCoupon({ validUntil: past }));

    await expect(validateCoupon('SAVE10')).rejects.toThrow('прострочений');
  });

  it('throws when coupon usage limit is exhausted', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(makeCoupon({ usageLimit: 5, usedCount: 5 }));

    await expect(validateCoupon('SAVE10')).rejects.toThrow('вичерпано');
  });

  it('throws when per-user usage limit is exceeded', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(makeCoupon({ usageLimitPerUser: 1 }));
    mockPrisma.couponRedemption.count.mockResolvedValue(1);

    await expect(validateCoupon('SAVE10', 42)).rejects.toThrow('максимальну кількість');
  });

  it('throws when order amount is below minimum', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(makeCoupon({ minOrderAmount: 500 }));

    await expect(validateCoupon('SAVE10', undefined, 200)).rejects.toThrow('Мінімальна сума');
  });

  it('passes when order amount meets minimum', async () => {
    const coupon = makeCoupon({ minOrderAmount: 500 });
    mockPrisma.coupon.findUnique.mockResolvedValue(coupon);

    const result = await validateCoupon('SAVE10', undefined, 600);
    expect(result).toEqual(coupon);
  });
});

// ---------------------------------------------------------------------------
// calculateDiscount
// ---------------------------------------------------------------------------

describe('calculateDiscount', () => {
  it('calculates percent discount correctly', () => {
    const result = calculateDiscount({ type: 'percent', value: 10, maxDiscount: null }, 1000);
    expect(result).toBe(100);
  });

  it('caps percent discount at maxDiscount', () => {
    const result = calculateDiscount({ type: 'percent', value: 50, maxDiscount: 200 }, 1000);
    expect(result).toBe(200);
  });

  it('calculates fixed_amount discount correctly', () => {
    const result = calculateDiscount({ type: 'fixed_amount', value: 150, maxDiscount: null }, 1000);
    expect(result).toBe(150);
  });

  it('caps fixed_amount discount at orderAmount', () => {
    const result = calculateDiscount({ type: 'fixed_amount', value: 500, maxDiscount: null }, 300);
    expect(result).toBe(300);
  });

  it('returns 0 for free_delivery type', () => {
    const result = calculateDiscount({ type: 'free_delivery', value: 0, maxDiscount: null }, 1000);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// redeemCoupon
// ---------------------------------------------------------------------------

describe('redeemCoupon', () => {
  it('creates redemption and increments usedCount via transaction', async () => {
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await redeemCoupon(1, 42, 100, 50);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getCoupons
// ---------------------------------------------------------------------------

describe('getCoupons', () => {
  it('returns paginated coupons', async () => {
    const coupons = [makeCoupon()];
    mockPrisma.coupon.findMany.mockResolvedValue(coupons);
    mockPrisma.coupon.count.mockResolvedValue(1);

    const result = await getCoupons(1, 20);
    expect(result).toEqual({ coupons, total: 1 });
    expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, skip: 0, take: 20 })
    );
  });

  it('passes empty where when showExpired is true', async () => {
    mockPrisma.coupon.findMany.mockResolvedValue([]);
    mockPrisma.coupon.count.mockResolvedValue(0);

    await getCoupons(1, 20, true);
    expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});

// ---------------------------------------------------------------------------
// createCoupon
// ---------------------------------------------------------------------------

describe('createCoupon', () => {
  it('creates a coupon with uppercased code', async () => {
    const created = makeCoupon();
    mockPrisma.coupon.create.mockResolvedValue(created);

    const result = await createCoupon({
      code: 'summer',
      type: 'percent',
      value: 15,
    });

    expect(result).toEqual(created);
    expect(mockPrisma.coupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'SUMMER', type: 'percent', value: 15 }),
    });
  });
});

// ---------------------------------------------------------------------------
// updateCoupon
// ---------------------------------------------------------------------------

describe('updateCoupon', () => {
  it('updates coupon fields', async () => {
    const updated = makeCoupon({ isActive: false });
    mockPrisma.coupon.update.mockResolvedValue(updated);

    const result = await updateCoupon(1, { isActive: false, description: 'Updated' });
    expect(result).toEqual(updated);
    expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ isActive: false, description: 'Updated' }),
    });
  });
});

// ---------------------------------------------------------------------------
// deleteCoupon
// ---------------------------------------------------------------------------

describe('deleteCoupon', () => {
  it('deletes the coupon', async () => {
    mockPrisma.coupon.delete.mockResolvedValue(makeCoupon());

    await deleteCoupon(1);
    expect(mockPrisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
