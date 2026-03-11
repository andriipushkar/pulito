import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import { getRecommendations, buildBoughtTogetherRecommendations } from './recommendation';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productRecommendation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
  },
}));

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
