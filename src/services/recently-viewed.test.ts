import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    recentlyViewed: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { addRecentlyViewed, getRecentlyViewed, clearRecentlyViewed } from './recently-viewed';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addRecentlyViewed', () => {
  it('upserts with userId and productId', async () => {
    vi.mocked(prisma.recentlyViewed.upsert).mockResolvedValue({} as any);

    await addRecentlyViewed(1, 42);

    expect(prisma.recentlyViewed.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 1, productId: 42 } },
      update: { viewedAt: expect.any(Date) },
      create: { userId: 1, productId: 42 },
    });
  });
});

describe('getRecentlyViewed', () => {
  it('returns products ordered by viewedAt desc', async () => {
    const items = [{ id: 1, product: { id: 42, name: 'Test' } }];
    vi.mocked(prisma.recentlyViewed.findMany).mockResolvedValue(items as any);

    const result = await getRecentlyViewed(1, 10);

    expect(result).toEqual(items);
    expect(prisma.recentlyViewed.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        orderBy: { viewedAt: 'desc' },
        take: 10,
        include: expect.objectContaining({
          product: expect.any(Object),
        }),
      }),
    );
  });
});

describe('clearRecentlyViewed', () => {
  it('deletes all for user', async () => {
    vi.mocked(prisma.recentlyViewed.deleteMany).mockResolvedValue({ count: 5 });

    await clearRecentlyViewed(1);

    expect(prisma.recentlyViewed.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
  });
});
