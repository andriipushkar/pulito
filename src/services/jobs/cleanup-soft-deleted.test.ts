import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDeleteManyProduct = vi.fn();
const mockDeleteManyCategory = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { deleteMany: (...args: unknown[]) => mockDeleteManyProduct(...args) },
    category: { deleteMany: (...args: unknown[]) => mockDeleteManyCategory(...args) },
  },
}));

import { cleanupSoftDeleted } from './cleanup-soft-deleted';

beforeEach(() => vi.clearAllMocks());

describe('cleanupSoftDeleted', () => {
  it('deletes products and categories older than 90 days', async () => {
    mockDeleteManyProduct.mockResolvedValue({ count: 5 });
    mockDeleteManyCategory.mockResolvedValue({ count: 2 });

    const result = await cleanupSoftDeleted();

    expect(result).toEqual({ categories: 2, products: 5 });
    expect(mockDeleteManyProduct).toHaveBeenCalledWith({
      where: { deletedAt: { not: null, lt: expect.any(Date) } },
    });
    expect(mockDeleteManyCategory).toHaveBeenCalledWith({
      where: { deletedAt: { not: null, lt: expect.any(Date) } },
    });
  });

  it('returns zeros when nothing to delete', async () => {
    mockDeleteManyProduct.mockResolvedValue({ count: 0 });
    mockDeleteManyCategory.mockResolvedValue({ count: 0 });

    const result = await cleanupSoftDeleted();

    expect(result).toEqual({ categories: 0, products: 0 });
  });

  it('deletes products before categories (FK order)', async () => {
    const callOrder: string[] = [];
    mockDeleteManyProduct.mockImplementation(() => { callOrder.push('product'); return { count: 0 }; });
    mockDeleteManyCategory.mockImplementation(() => { callOrder.push('category'); return { count: 0 }; });

    await cleanupSoftDeleted();

    expect(callOrder).toEqual(['product', 'category']);
  });
});
