import { describe, it, expect } from 'vitest';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  updateStockSchema,
} from './warehouse';

describe('warehouse validators', () => {
  describe('createWarehouseSchema', () => {
    const validData = {
      name: 'Main Warehouse',
      code: 'WH-01',
      city: 'Kyiv',
    };

    it('should accept valid data with required fields', () => {
      const result = createWarehouseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept all optional fields', () => {
      const result = createWarehouseSchema.safeParse({
        ...validData,
        address: '123 Street',
        latitude: 50.4501,
        longitude: 30.5234,
        isDefault: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 2 characters', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 200 characters', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, name: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('should reject empty code', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, code: '' });
      expect(result.success).toBe(false);
    });

    it('should reject code with invalid characters', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, code: 'WH 01!' });
      expect(result.success).toBe(false);
    });

    it('should accept code with letters, numbers, underscores, dashes', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, code: 'WH_01-main' });
      expect(result.success).toBe(true);
    });

    it('should reject city shorter than 2 characters', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, city: 'K' });
      expect(result.success).toBe(false);
    });

    it('should reject latitude less than -90', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, latitude: -91 });
      expect(result.success).toBe(false);
    });

    it('should reject latitude greater than 90', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, latitude: 91 });
      expect(result.success).toBe(false);
    });

    it('should reject longitude less than -180', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, longitude: -181 });
      expect(result.success).toBe(false);
    });

    it('should reject longitude greater than 180', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, longitude: 181 });
      expect(result.success).toBe(false);
    });

    it('should accept boundary latitude values', () => {
      expect(createWarehouseSchema.safeParse({ ...validData, latitude: -90 }).success).toBe(true);
      expect(createWarehouseSchema.safeParse({ ...validData, latitude: 90 }).success).toBe(true);
    });

    it('should accept boundary longitude values', () => {
      expect(createWarehouseSchema.safeParse({ ...validData, longitude: -180 }).success).toBe(true);
      expect(createWarehouseSchema.safeParse({ ...validData, longitude: 180 }).success).toBe(true);
    });

    it('should default isDefault to false', () => {
      const result = createWarehouseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isDefault).toBe(false);
      }
    });

    it('should reject missing required fields', () => {
      const result = createWarehouseSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject address longer than 500 characters', () => {
      const result = createWarehouseSchema.safeParse({ ...validData, address: 'A'.repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe('updateWarehouseSchema', () => {
    it('should accept partial data', () => {
      const result = updateWarehouseSchema.safeParse({ name: 'Updated Warehouse' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateWarehouseSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate field constraints on update', () => {
      const result = updateWarehouseSchema.safeParse({ code: 'bad code!' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStockSchema', () => {
    it('should accept valid stock items', () => {
      const result = updateStockSchema.safeParse({
        items: [{ productId: 1, quantity: 10 }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept multiple items', () => {
      const result = updateStockSchema.safeParse({
        items: [
          { productId: 1, quantity: 10 },
          { productId: 2, quantity: 0 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept quantity of 0', () => {
      const result = updateStockSchema.safeParse({
        items: [{ productId: 1, quantity: 0 }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', () => {
      const result = updateStockSchema.safeParse({
        items: [{ productId: 1, quantity: -5 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive productId', () => {
      const result = updateStockSchema.safeParse({
        items: [{ productId: 0, quantity: 10 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty items array', () => {
      const result = updateStockSchema.safeParse({ items: [] });
      expect(result.success).toBe(false);
    });

    it('should reject missing items', () => {
      const result = updateStockSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
