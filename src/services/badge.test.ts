import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    productBadge: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { autoAssignBadges } from './badge';

const productFindMany = prisma.product.findMany as ReturnType<typeof vi.fn>;
const badgeCreateMany = prisma.productBadge.createMany as ReturnType<typeof vi.fn>;
const badgeDeleteMany = prisma.productBadge.deleteMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  badgeCreateMany.mockResolvedValue({ count: 0 });
  badgeDeleteMany.mockResolvedValue({ count: 0 });
});

describe('autoAssignBadges', () => {
  it('assigns new_arrival badges to new products', async () => {
    productFindMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // new products
      .mockResolvedValueOnce([]); // hit products

    const result = await autoAssignBadges();

    // Service now bulk-inserts via createMany (skipDuplicates) instead of N creates.
    expect(badgeCreateMany).toHaveBeenCalledWith({
      data: [
        { productId: 1, badgeType: 'new_arrival', priority: 5, isActive: true },
        { productId: 2, badgeType: 'new_arrival', priority: 5, isActive: true },
      ],
      skipDuplicates: true,
    });
    expect(result.newArrivals).toBe(2);
  });

  it('assigns hit badges to popular products', async () => {
    productFindMany
      .mockResolvedValueOnce([]) // new products
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }]); // hit products

    const result = await autoAssignBadges();

    expect(badgeCreateMany).toHaveBeenCalledWith({
      data: [
        { productId: 10, badgeType: 'hit', priority: 4, isActive: true },
        { productId: 11, badgeType: 'hit', priority: 4, isActive: true },
      ],
      skipDuplicates: true,
    });
    expect(result.hits).toBe(2);
  });

  it('cleans up expired badges', async () => {
    productFindMany
      .mockResolvedValueOnce([]) // new products
      .mockResolvedValueOnce([]); // hit products

    await autoAssignBadges();

    // deleteMany is called twice: expired new_arrival + demoted hit. Admin-locked
    // badges are excluded via isLocked: false.
    expect(badgeDeleteMany).toHaveBeenCalledTimes(2);
    expect(badgeDeleteMany).toHaveBeenCalledWith({
      where: {
        badgeType: 'new_arrival',
        isLocked: false,
        product: { createdAt: { lt: expect.any(Date) } },
      },
    });
    expect(badgeDeleteMany).toHaveBeenCalledWith({
      where: {
        badgeType: 'hit',
        isLocked: false,
        product: { ordersCount: { lt: 10 } },
      },
    });
  });

  it('returns correct counts', async () => {
    productFindMany
      .mockResolvedValueOnce([{ id: 1 }]) // 1 new product
      .mockResolvedValueOnce([{ id: 2 }, { id: 3 }]); // 2 hit products

    const result = await autoAssignBadges();

    expect(result).toEqual({ newArrivals: 1, hits: 2 });
  });

  it('handles no products needing badges', async () => {
    productFindMany
      .mockResolvedValueOnce([]) // no new products
      .mockResolvedValueOnce([]); // no hit products

    const result = await autoAssignBadges();

    expect(badgeCreateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ newArrivals: 0, hits: 0 });
  });
});
