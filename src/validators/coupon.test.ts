import { describe, it, expect } from 'vitest';
import { applyCouponSchema, createCouponSchema, updateCouponSchema } from './coupon';

describe('applyCouponSchema', () => {
  it('should accept valid code', () => {
    const result = applyCouponSchema.safeParse({ code: 'SAVE10' });
    expect(result.success).toBe(true);
  });

  it('should reject empty code', () => {
    expect(applyCouponSchema.safeParse({ code: '' }).success).toBe(false);
  });

  it('should reject missing code', () => {
    expect(applyCouponSchema.safeParse({}).success).toBe(false);
  });
});

describe('createCouponSchema', () => {
  const validCoupon = {
    code: 'SUMMER2024',
    type: 'percent' as const,
    value: 15,
  };

  it('should accept valid coupon data', () => {
    const result = createCouponSchema.safeParse(validCoupon);
    expect(result.success).toBe(true);
  });

  it('should accept all coupon types', () => {
    for (const type of ['percent', 'fixed_amount', 'free_delivery']) {
      const result = createCouponSchema.safeParse({ ...validCoupon, type });
      expect(result.success).toBe(true);
    }
  });

  it('should accept valid data with all optional fields', () => {
    const result = createCouponSchema.safeParse({
      ...validCoupon,
      description: 'Знижка на літо',
      minOrderAmount: 500,
      maxDiscount: 200,
      usageLimit: 100,
      usageLimitPerUser: 1,
      validFrom: '2024-06-01',
      validUntil: '2024-08-31',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid code format (special chars)', () => {
    const result = createCouponSchema.safeParse({ ...validCoupon, code: 'SAVE 10!' });
    expect(result.success).toBe(false);
  });

  it('should reject code shorter than 2 characters', () => {
    const result = createCouponSchema.safeParse({ ...validCoupon, code: 'A' });
    expect(result.success).toBe(false);
  });

  it('should reject missing type', () => {
    const { type, ...noType } = validCoupon;
    expect(createCouponSchema.safeParse(noType).success).toBe(false);
  });

  it('should reject invalid type', () => {
    const result = createCouponSchema.safeParse({ ...validCoupon, type: 'bogus' });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive value', () => {
    expect(createCouponSchema.safeParse({ ...validCoupon, value: 0 }).success).toBe(false);
    expect(createCouponSchema.safeParse({ ...validCoupon, value: -5 }).success).toBe(false);
  });

  it('should reject non-integer usageLimit', () => {
    const result = createCouponSchema.safeParse({ ...validCoupon, usageLimit: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe('updateCouponSchema', () => {
  it('should accept partial updates', () => {
    const result = updateCouponSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('should accept empty object (no updates)', () => {
    const result = updateCouponSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept multiple fields', () => {
    const result = updateCouponSchema.safeParse({
      description: 'Updated',
      usageLimit: 50,
      maxDiscount: 100,
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-positive maxDiscount', () => {
    const result = updateCouponSchema.safeParse({ maxDiscount: -10 });
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean isActive', () => {
    const result = updateCouponSchema.safeParse({ isActive: 'yes' });
    expect(result.success).toBe(false);
  });
});
