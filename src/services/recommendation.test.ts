import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import {
  getRecommendations,
  buildBoughtTogetherRecommendations,
  buildCollaborativeRecommendations,
  getPersonalizedRecommendations,
} from './recommendation';

vi.mock('@/lib/prisma', () => {
  const mockRec = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };
  const mockProduct = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  };
  const mockOrder = {
    findMany: vi.fn(),
  };
  return {
    prisma: {
      productRecommendation: mockRec,
      product: mockProduct,
      order: mockOrder,
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        // Pass the same mocks as the transaction client
        return fn({
          productRecommendation: mockRec,
          product: mockProduct,
          order: mockOrder,
        });
      }),
    },
  };
});

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
  },
  CACHE_TTL: { SHORT: 300, MEDIUM: 1800, LONG: 3600 },
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
const mockPrisma = prisma as unknown as MockPrismaClient;
const mockRedis = redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

const mockProduct = (id: number) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  code: `P${id}`,
  priceRetail: 100,
  imagePath: null,
  isPromo: false,
  isActive: true,
  images: [],
});

describe('getRecommendations', () => {
  it('should return cached results when available', async () => {
    const cached = [mockProduct(2), mockProduct(3)];
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await getRecommendations(1);
    expect(result).toEqual(cached);
    expect(mockPrisma.productRecommendation.findMany).not.toHaveBeenCalled();
  });

  it('should fetch manual recommendations first', async () => {
    mockRedis.get.mockResolvedValue(null);
    const products = Array.from({ length: 8 }, (_, i) => ({
      recommendedProduct: mockProduct(i + 2),
    }));
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce(products as never);

    const result = await getRecommendations(1);
    expect(result).toHaveLength(8);
    expect(mockRedis.setex).toHaveBeenCalled();
  });

  it('should fill with auto recommendations when manual not enough', async () => {
    mockRedis.get.mockResolvedValue(null);
    // Manual returns 2
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: mockProduct(2) },
      { recommendedProduct: mockProduct(3) },
    ] as never);
    // Auto returns 3
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: mockProduct(4) },
      { recommendedProduct: mockProduct(5) },
      { recommendedProduct: mockProduct(6) },
    ] as never);
    // Category fill
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: 1 } as never);
    mockPrisma.product.findMany.mockResolvedValue([
      mockProduct(7),
      mockProduct(8),
      mockProduct(9),
    ] as never);

    const result = await getRecommendations(1);
    expect(result).toHaveLength(8);
  });

  it('should filter inactive products', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: { ...mockProduct(2), isActive: false } },
      { recommendedProduct: mockProduct(3) },
    ] as never);
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: 1 } as never);
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    const result = await getRecommendations(1);
    expect(result.every((p) => p.id !== 2)).toBe(true);
  });

  it('should skip category fill when manual + auto >= limit', async () => {
    mockRedis.get.mockResolvedValue(null);
    // Manual returns 4
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce(
      Array.from({ length: 4 }, (_, i) => ({ recommendedProduct: mockProduct(i + 2) })) as never
    );
    // Auto returns 4
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce(
      Array.from({ length: 4 }, (_, i) => ({ recommendedProduct: mockProduct(i + 10) })) as never
    );

    const result = await getRecommendations(1);
    expect(result).toHaveLength(8);
    // product.findUnique should NOT be called since combined.length >= limit
    expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
  });

  it('should handle product with no categoryId', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: mockProduct(2) },
    ] as never);
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: null } as never);

    const result = await getRecommendations(1);
    expect(result).toHaveLength(1);
  });

  it('should handle product not found when filling category', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([] as never);
    mockPrisma.product.findUnique.mockResolvedValue(null as never);

    const result = await getRecommendations(1);
    expect(result).toHaveLength(0);
  });
});

describe('buildBoughtTogetherRecommendations', () => {
  it('should build recommendations from order pairs', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { items: [{ productId: 1 }, { productId: 2 }] },
      { items: [{ productId: 1 }, { productId: 2 }] },
    ] as never);
    mockPrisma.productRecommendation.findFirst.mockResolvedValue(null);
    mockPrisma.productRecommendation.create.mockResolvedValue({} as never);

    const count = await buildBoughtTogetherRecommendations();
    // pair 1:2 has count=2, creates both directions
    expect(count).toBe(2);
    expect(mockPrisma.productRecommendation.create).toHaveBeenCalledTimes(2);
  });

  it('should skip pairs with count < 2', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { items: [{ productId: 1 }, { productId: 2 }] },
    ] as never);

    const count = await buildBoughtTogetherRecommendations();
    expect(count).toBe(0);
  });

  it('should update existing recommendations', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { items: [{ productId: 1 }, { productId: 2 }] },
      { items: [{ productId: 1 }, { productId: 2 }] },
    ] as never);
    mockPrisma.productRecommendation.findFirst.mockResolvedValue({ id: 99 } as never);
    mockPrisma.productRecommendation.update.mockResolvedValue({} as never);

    const count = await buildBoughtTogetherRecommendations();
    expect(count).toBe(2);
    expect(mockPrisma.productRecommendation.update).toHaveBeenCalledTimes(2);
  });

  it('should handle empty orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    const count = await buildBoughtTogetherRecommendations();
    expect(count).toBe(0);
  });
});

describe('buildCollaborativeRecommendations', () => {
  it('should calculate correct Jaccard scores', async () => {
    // User 1 bought products 1, 2
    // User 2 bought products 1, 2, 3
    // User 3 bought products 2, 3
    // Jaccard(1,2) = |{u1,u2}| / |{u1,u2,u3}| = 2/3 ≈ 0.667
    // Jaccard(1,3) = |{u2}| / |{u1,u2,u3}| = 1/3 ≈ 0.333
    // Jaccard(2,3) = |{u2,u3}| / |{u1,u2,u3}| = 2/3 ≈ 0.667
    mockPrisma.order.findMany.mockResolvedValue([
      { userId: 1, items: [{ productId: 1 }, { productId: 2 }] },
      { userId: 2, items: [{ productId: 1 }, { productId: 2 }, { productId: 3 }] },
      { userId: 3, items: [{ productId: 2 }, { productId: 3 }] },
    ] as never);
    mockPrisma.productRecommendation.deleteMany.mockResolvedValue({ count: 0 } as never);
    mockPrisma.productRecommendation.create.mockResolvedValue({} as never);

    const count = await buildCollaborativeRecommendations();

    // 3 pairs × 2 directions = 6 recs
    expect(count).toBe(6);
    expect(mockPrisma.productRecommendation.create).toHaveBeenCalledTimes(6);

    // Verify one of the Jaccard scores (product 1 → product 2, score ≈ 0.667)
    const calls = mockPrisma.productRecommendation.create.mock.calls;
    const rec12 = calls.find(
      (c: unknown[]) =>
        (c[0] as { data: { productId: number; recommendedProductId: number } }).data.productId === 1 &&
        (c[0] as { data: { productId: number; recommendedProductId: number } }).data.recommendedProductId === 2
    );
    expect(rec12).toBeDefined();
    const score = (rec12![0] as { data: { score: number } }).data.score;
    expect(score).toBeCloseTo(2 / 3, 5);
  });

  it('should filter out pairs below minScore threshold', async () => {
    // User 1 bought products 1, 2
    // User 2 bought product 1 only
    // User 3 bought product 2 only
    // Jaccard(1,2) = |{u1}| / |{u1,u2,u3}| = 1/3 ≈ 0.333
    mockPrisma.order.findMany.mockResolvedValue([
      { userId: 1, items: [{ productId: 1 }, { productId: 2 }] },
      { userId: 2, items: [{ productId: 1 }] },
      { userId: 3, items: [{ productId: 2 }] },
    ] as never);
    mockPrisma.productRecommendation.deleteMany.mockResolvedValue({ count: 0 } as never);
    mockPrisma.productRecommendation.create.mockResolvedValue({} as never);

    // With high minScore, pair should be filtered
    const count = await buildCollaborativeRecommendations({ minScore: 0.5 });
    expect(count).toBe(0);
  });

  it('should handle empty orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([] as never);
    mockPrisma.productRecommendation.deleteMany.mockResolvedValue({ count: 0 } as never);

    const count = await buildCollaborativeRecommendations();
    expect(count).toBe(0);
  });
});

describe('getPersonalizedRecommendations', () => {
  it('should return products user has not bought', async () => {
    mockRedis.get.mockResolvedValue(null);
    // User bought product 1
    mockPrisma.order.findMany.mockResolvedValueOnce([
      { items: [{ productId: 1 }] },
    ] as never);
    // Collaborative recs for product 1
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: mockProduct(2) },
      { recommendedProduct: mockProduct(3) },
    ] as never);

    const result = await getPersonalizedRecommendations(1, 2);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.id !== 1)).toBe(true);
    expect(result.map((p) => p.id)).toEqual([2, 3]);
  });

  it('should fall back to popular products when no purchase history', async () => {
    mockRedis.get.mockResolvedValue(null);
    // User has no orders
    mockPrisma.order.findMany.mockResolvedValueOnce([] as never);
    // Fallback popular products
    mockPrisma.product.findMany.mockResolvedValueOnce([
      mockProduct(10),
      mockProduct(11),
    ] as never);

    const result = await getPersonalizedRecommendations(1, 2);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual([10, 11]);
  });

  it('should return cached results when available', async () => {
    const cached = [mockProduct(5), mockProduct(6)];
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await getPersonalizedRecommendations(1);
    expect(result).toEqual(cached);
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
  });

  it('should combine collaborative + bought_together + fallback', async () => {
    mockRedis.get.mockResolvedValue(null);
    // User bought product 1
    mockPrisma.order.findMany.mockResolvedValueOnce([
      { items: [{ productId: 1 }] },
    ] as never);
    // Collaborative returns 1 result
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: mockProduct(2) },
    ] as never);
    // Bought_together returns 1 result
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([
      { recommendedProduct: mockProduct(3) },
    ] as never);
    // Similar returns 0
    mockPrisma.productRecommendation.findMany.mockResolvedValueOnce([] as never);
    // Fallback popular
    mockPrisma.product.findMany.mockResolvedValueOnce([
      mockProduct(4),
    ] as never);

    const result = await getPersonalizedRecommendations(1, 4);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual([2, 3, 4]);
  });
});
