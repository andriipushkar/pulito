import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDeleteManyProduct = vi.fn();
const mockDeleteManyCategory = vi.fn();
const mockDeleteManyOrder = vi.fn();
const mockDeleteManyUser = vi.fn();
const mockDeleteManyPayment = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { deleteMany: (...args: unknown[]) => mockDeleteManyProduct(...args) },
    category: { deleteMany: (...args: unknown[]) => mockDeleteManyCategory(...args) },
    order: { deleteMany: (...args: unknown[]) => mockDeleteManyOrder(...args) },
    user: { deleteMany: (...args: unknown[]) => mockDeleteManyUser(...args) },
    payment: { deleteMany: (...args: unknown[]) => mockDeleteManyPayment(...args) },
  },
}));

import { cleanupSoftDeleted } from './cleanup-soft-deleted';

beforeEach(() => vi.clearAllMocks());

describe('cleanupSoftDeleted', () => {
  it('deletes all soft-deleted records beyond retention', async () => {
    mockDeleteManyProduct.mockResolvedValue({ count: 5 });
    mockDeleteManyCategory.mockResolvedValue({ count: 2 });
    mockDeleteManyOrder.mockResolvedValue({ count: 1 });
    mockDeleteManyUser.mockResolvedValue({ count: 0 });
    mockDeleteManyPayment.mockResolvedValue({ count: 3 });

    const result = await cleanupSoftDeleted();

    expect(result).toEqual({
      categories: 2,
      products: 5,
      orders: 1,
      users: 0,
      payments: 3,
    });
  });

  it('returns zeros when nothing to delete', async () => {
    mockDeleteManyProduct.mockResolvedValue({ count: 0 });
    mockDeleteManyCategory.mockResolvedValue({ count: 0 });
    mockDeleteManyOrder.mockResolvedValue({ count: 0 });
    mockDeleteManyUser.mockResolvedValue({ count: 0 });
    mockDeleteManyPayment.mockResolvedValue({ count: 0 });

    const result = await cleanupSoftDeleted();

    expect(result).toEqual({
      categories: 0,
      products: 0,
      orders: 0,
      users: 0,
      payments: 0,
    });
  });

  it('deletes products before categories (FK order)', async () => {
    const callOrder: string[] = [];
    mockDeleteManyProduct.mockImplementation(() => {
      callOrder.push('product');
      return { count: 0 };
    });
    mockDeleteManyCategory.mockImplementation(() => {
      callOrder.push('category');
      return { count: 0 };
    });
    mockDeleteManyPayment.mockImplementation(() => {
      callOrder.push('payment');
      return { count: 0 };
    });
    mockDeleteManyOrder.mockImplementation(() => {
      callOrder.push('order');
      return { count: 0 };
    });
    mockDeleteManyUser.mockImplementation(() => {
      callOrder.push('user');
      return { count: 0 };
    });

    await cleanupSoftDeleted();

    // Products before categories (FK), payments before orders (FK)
    expect(callOrder.indexOf('product')).toBeLessThan(callOrder.indexOf('category'));
    expect(callOrder.indexOf('payment')).toBeLessThan(callOrder.indexOf('order'));
  });

  it('uses longer retention for financial records', async () => {
    mockDeleteManyProduct.mockResolvedValue({ count: 0 });
    mockDeleteManyCategory.mockResolvedValue({ count: 0 });
    mockDeleteManyOrder.mockResolvedValue({ count: 0 });
    mockDeleteManyUser.mockResolvedValue({ count: 0 });
    mockDeleteManyPayment.mockResolvedValue({ count: 0 });

    await cleanupSoftDeleted();

    // Products/categories use 90-day cutoff
    const productCutoff = mockDeleteManyProduct.mock.calls[0][0].where.deletedAt.lt;
    // Orders use 365-day cutoff
    const orderCutoff = mockDeleteManyOrder.mock.calls[0][0].where.deletedAt.lt;

    // Financial cutoff should be older (further in the past)
    expect(orderCutoff.getTime()).toBeLessThan(productCutoff.getTime());
  });
});
