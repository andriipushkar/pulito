import { describe, it, expect } from 'vitest';
import {
  personalPriceFilterSchema,
  createPersonalPriceSchema,
  updatePersonalPriceSchema,
} from './personal-price';

describe('personalPriceFilterSchema', () => {
  it('should apply defaults', () => {
    const result = personalPriceFilterSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should accept all filters', () => {
    const result = personalPriceFilterSchema.parse({
      page: 2,
      limit: 50,
      userId: 1,
      productId: 5,
      categoryId: 3,
    });
    expect(result.userId).toBe(1);
  });
});

describe('createPersonalPriceSchema', () => {
  it('should accept valid data with productId and discountPercent', () => {
    const result = createPersonalPriceSchema.safeParse({
      userId: 1,
      productId: 5,
      discountPercent: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should accept categoryId with fixedPrice', () => {
    const result = createPersonalPriceSchema.safeParse({
      userId: 1,
      categoryId: 3,
      fixedPrice: 99.99,
    });
    expect(result.success).toBe(true);
  });

  it('should reject without productId or categoryId', () => {
    const result = createPersonalPriceSchema.safeParse({
      userId: 1,
      discountPercent: 10,
    });
    expect(result.success).toBe(false);
  });

  it('should reject without discountPercent or fixedPrice', () => {
    const result = createPersonalPriceSchema.safeParse({
      userId: 1,
      productId: 5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject discountPercent > 100', () => {
    const result = createPersonalPriceSchema.safeParse({
      userId: 1,
      productId: 5,
      discountPercent: 150,
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePersonalPriceSchema', () => {
  it('should accept partial update', () => {
    const result = updatePersonalPriceSchema.safeParse({ discountPercent: 15 });
    expect(result.success).toBe(true);
  });

  it('should accept nullable dates', () => {
    const result = updatePersonalPriceSchema.safeParse({
      validFrom: null,
      validUntil: null,
    });
    expect(result.success).toBe(true);
  });
});
