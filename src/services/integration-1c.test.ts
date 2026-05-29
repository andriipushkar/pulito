import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transform1CProduct, transformOrderTo1C } from './integration-1c';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/services/cache', () => ({
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/slug', () => ({
  createSlug: vi.fn((name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  ),
}));

describe('integration-1c', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transform1CProduct', () => {
    it('maps 1C fields to internal product format', () => {
      const input = {
        code: 'SKU-001',
        name: 'Test Product',
        priceRetail: 199.99,
        priceWholesale: 149.99,
        quantity: 50,
        isActive: true,
      };

      const result = transform1CProduct(input);

      expect(result).toEqual({
        code: 'SKU-001',
        name: 'Test Product',
        slug: 'test-product',
        priceRetail: 199.99,
        priceWholesale: 149.99,
        quantity: 50,
        isActive: true,
        weightGrams: null,
        lengthMm: null,
        widthMm: null,
        heightMm: null,
        cost: null,
      });
    });

    it('uses defaults for optional fields', () => {
      const input = {
        code: 'SKU-002',
        name: 'Minimal Product',
      };

      const result = transform1CProduct(input);

      expect(result.priceRetail).toBe(0);
      expect(result.priceWholesale).toBeNull();
      expect(result.quantity).toBe(0);
      expect(result.isActive).toBe(true);
    });

    it('trims whitespace from code and name', () => {
      const input = {
        code: '  SKU-003  ',
        name: '  Trimmed Product  ',
      };

      const result = transform1CProduct(input);

      expect(result.code).toBe('SKU-003');
      expect(result.name).toBe('Trimmed Product');
    });
  });

  describe('transformOrderTo1C', () => {
    it('maps internal order to 1C format', () => {
      const order = {
        id: 1,
        orderNumber: 'ORD-001',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        status: 'confirmed',
        totalAmount: 500,
        deliveryMethod: 'nova_poshta',
        deliveryAddress: 'Kyiv, Branch 42',
        paymentMethod: 'liqpay',
        user: {
          fullName: 'Test User',
          phone: '+380501234567',
          email: 'test@example.com',
        },
        items: [
          {
            quantity: 2,
            price: 250,
            product: { code: 'SKU-001', name: 'Product A' },
          },
        ],
      };

      const result = transformOrderTo1C(order);

      expect(result.orderNumber).toBe('ORD-001');
      expect(result.customerName).toBe('Test User');
      expect(result.totalAmount).toBe(500);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].code).toBe('SKU-001');
      expect(result.items[0].total).toBe(500);
    });

    it('handles missing user data gracefully', () => {
      const order = {
        id: 2,
        orderNumber: 'ORD-002',
        createdAt: new Date(),
        status: 'new',
        totalAmount: 0,
        deliveryMethod: null,
        deliveryAddress: null,
        paymentMethod: null,
        user: null,
        items: [],
      };

      const result = transformOrderTo1C(order);

      expect(result.customerName).toBe('');
      expect(result.customerPhone).toBe('');
      expect(result.deliveryMethod).toBe('');
    });
  });

  describe('importProductsFrom1C', () => {
    it('creates new products when code does not exist', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { importProductsFrom1C } = await import('./integration-1c');

      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.product.create).mockResolvedValue({
        id: 1,
        code: 'NEW-001',
        name: 'New Product',
      } as never);

      const result = await importProductsFrom1C([
        { code: 'NEW-001', name: 'New Product', priceRetail: 100 },
      ]);

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('updates existing products by code', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { importProductsFrom1C } = await import('./integration-1c');

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 5,
        code: 'EXIST-001',
        name: 'Old Name',
        slug: 'old-name',
      } as never);
      vi.mocked(prisma.product.update).mockResolvedValue({} as never);
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

      const result = await importProductsFrom1C([
        { code: 'EXIST-001', name: 'Updated Name', priceRetail: 200 },
      ]);

      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('handles duplicate SKU errors gracefully', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { importProductsFrom1C } = await import('./integration-1c');

      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.product.create).mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`code`)'),
      );

      const result = await importProductsFrom1C([
        { code: 'DUP-001', name: 'Duplicate', priceRetail: 100 },
      ]);

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DUP-001');
    });
  });

  describe('updateStockFrom1C', () => {
    it('adjusts product quantities', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { updateStockFrom1C } = await import('./integration-1c');

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 1,
        code: 'SKU-001',
        quantity: 10,
      } as never);
      vi.mocked(prisma.product.update).mockResolvedValue({} as never);

      const result = await updateStockFrom1C([{ code: 'SKU-001', quantity: 25 }]);

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(0);
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantity: 25 },
        }),
      );
    });

    it('reports error for unknown product code', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { updateStockFrom1C } = await import('./integration-1c');

      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      const result = await updateStockFrom1C([{ code: 'UNKNOWN-999', quantity: 10 }]);

      expect(result.failed).toBe(1);
      expect(result.errors[0].message).toContain('Product not found');
    });
  });
});
