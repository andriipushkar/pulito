import { describe, it, expect } from 'vitest';
import { createBundleSchema, updateBundleSchema } from './bundle';

describe('bundle validators', () => {
  describe('createBundleSchema', () => {
    const validData = {
      name: 'Test Bundle',
      bundleType: 'curated' as const,
      items: [{ productId: 1, quantity: 2 }],
    };

    it('should accept valid data with required fields', () => {
      const result = createBundleSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid data with all optional fields', () => {
      const result = createBundleSchema.safeParse({
        ...validData,
        slug: 'test-bundle',
        description: 'Bundle description',
        discountPercent: 15,
        fixedPrice: 999,
        imagePath: '/images/bundle.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 2 characters', () => {
      const result = createBundleSchema.safeParse({ ...validData, name: 'A' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2 символи');
      }
    });

    it('should reject name longer than 200 characters', () => {
      const result = createBundleSchema.safeParse({ ...validData, name: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('should reject invalid bundleType', () => {
      const result = createBundleSchema.safeParse({ ...validData, bundleType: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept "custom" bundleType', () => {
      const result = createBundleSchema.safeParse({ ...validData, bundleType: 'custom' });
      expect(result.success).toBe(true);
    });

    it('should reject empty items array', () => {
      const result = createBundleSchema.safeParse({ ...validData, items: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('щонайменше один товар');
      }
    });

    it('should reject items with non-positive productId', () => {
      const result = createBundleSchema.safeParse({
        ...validData,
        items: [{ productId: -1, quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject items with quantity less than 1', () => {
      const result = createBundleSchema.safeParse({
        ...validData,
        items: [{ productId: 1, quantity: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject discountPercent greater than 100', () => {
      const result = createBundleSchema.safeParse({ ...validData, discountPercent: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject negative discountPercent', () => {
      const result = createBundleSchema.safeParse({ ...validData, discountPercent: -5 });
      expect(result.success).toBe(false);
    });

    it('should reject negative fixedPrice', () => {
      const result = createBundleSchema.safeParse({ ...validData, fixedPrice: -10 });
      expect(result.success).toBe(false);
    });

    it('should accept null fixedPrice', () => {
      const result = createBundleSchema.safeParse({ ...validData, fixedPrice: null });
      expect(result.success).toBe(true);
    });

    it('should reject invalid slug format', () => {
      const result = createBundleSchema.safeParse({ ...validData, slug: 'Bad Slug!' });
      expect(result.success).toBe(false);
    });

    it('should accept multiple items', () => {
      const result = createBundleSchema.safeParse({
        ...validData,
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 3 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateBundleSchema', () => {
    it('should accept partial data', () => {
      const result = updateBundleSchema.safeParse({ name: 'Updated Bundle' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateBundleSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should still validate field constraints', () => {
      const result = updateBundleSchema.safeParse({ name: 'A' });
      expect(result.success).toBe(false);
    });
  });
});
