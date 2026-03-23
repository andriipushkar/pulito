import { describe, it, expect } from 'vitest';
import {
  createVolumeDiscountSchema,
  updateVolumeDiscountSchema,
} from './volume-discount';

describe('volume-discount validators', () => {
  describe('createVolumeDiscountSchema', () => {
    const validData = {
      productId: 1,
      minQuantity: 5,
      discountPercent: 10,
    };

    it('should accept valid data with productId', () => {
      const result = createVolumeDiscountSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid data with categoryId', () => {
      const result = createVolumeDiscountSchema.safeParse({
        categoryId: 1,
        minQuantity: 10,
        discountPercent: 15,
      });
      expect(result.success).toBe(true);
    });

    it('should reject when neither productId nor categoryId provided', () => {
      const result = createVolumeDiscountSchema.safeParse({
        minQuantity: 5,
        discountPercent: 10,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('productId або categoryId');
      }
    });

    it('should reject minQuantity of 0', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, minQuantity: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative minQuantity', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, minQuantity: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject discountPercent greater than 100', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, discountPercent: 101 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100%');
      }
    });

    it('should reject negative discountPercent', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, discountPercent: -5 });
      expect(result.success).toBe(false);
    });

    it('should accept 0 discountPercent', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, discountPercent: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept 100 discountPercent', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, discountPercent: 100 });
      expect(result.success).toBe(true);
    });

    it('should reject maxQuantity less than minQuantity', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, maxQuantity: 3 });
      expect(result.success).toBe(false);
      if (!result.success) {
        const maxQtyIssue = result.error.issues.find((i) => i.path.includes('maxQuantity'));
        expect(maxQtyIssue?.message).toContain('maxQuantity має бути >= minQuantity');
      }
    });

    it('should accept maxQuantity equal to minQuantity', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, maxQuantity: 5 });
      expect(result.success).toBe(true);
    });

    it('should accept null maxQuantity', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, maxQuantity: null });
      expect(result.success).toBe(true);
    });

    it('should default discountType to percentage', () => {
      const result = createVolumeDiscountSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discountType).toBe('percentage');
      }
    });

    it('should accept fixed_amount discountType', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, discountType: 'fixed_amount' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid discountType', () => {
      const result = createVolumeDiscountSchema.safeParse({ ...validData, discountType: 'bogo' });
      expect(result.success).toBe(false);
    });

    it('should default isActive to true', () => {
      const result = createVolumeDiscountSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should default priority to 0', () => {
      const result = createVolumeDiscountSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(0);
      }
    });

    it('should accept null startsAt and endsAt', () => {
      const result = createVolumeDiscountSchema.safeParse({
        ...validData,
        startsAt: null,
        endsAt: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept date strings for startsAt and endsAt', () => {
      const result = createVolumeDiscountSchema.safeParse({
        ...validData,
        startsAt: '2025-01-01',
        endsAt: '2025-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should reject null productId and null categoryId together', () => {
      const result = createVolumeDiscountSchema.safeParse({
        productId: null,
        categoryId: null,
        minQuantity: 5,
        discountPercent: 10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateVolumeDiscountSchema', () => {
    it('should accept partial data', () => {
      const result = updateVolumeDiscountSchema.safeParse({ discountPercent: 20 });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateVolumeDiscountSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate field constraints', () => {
      const result = updateVolumeDiscountSchema.safeParse({ discountPercent: 200 });
      expect(result.success).toBe(false);
    });

    it('should accept null values for nullable fields', () => {
      const result = updateVolumeDiscountSchema.safeParse({
        productId: null,
        maxQuantity: null,
        startsAt: null,
        endsAt: null,
      });
      expect(result.success).toBe(true);
    });
  });
});
