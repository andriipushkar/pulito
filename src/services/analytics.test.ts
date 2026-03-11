import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyFunnelStats: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    orderItem: {
      groupBy: vi.fn(),
    },
  },
}));

describe('analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversionFunnel', () => {
    it('should aggregate funnel stats and calculate conversion rates', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.dailyFunnelStats.findMany).mockResolvedValue([
        {
          id: 1, date: new Date(), pageViews: 1000, productViews: 500,
          addToCartCount: 200, cartViews: 150, checkoutStarts: 100,
          ordersCompleted: 50, totalRevenue: 25000, uniqueVisitors: 800,
        },
        {
          id: 2, date: new Date(), pageViews: 800, productViews: 400,
          addToCartCount: 160, cartViews: 120, checkoutStarts: 80,
          ordersCompleted: 40, totalRevenue: 20000, uniqueVisitors: 600,
        },
      ] as never);

      const { getConversionFunnel } = await import('./analytics');
      const result = await getConversionFunnel(30);

      expect(result.totals.pageViews).toBe(1800);
      expect(result.totals.ordersCompleted).toBe(90);
      expect(result.steps).toHaveLength(6);
      expect(result.steps[0].conversionFromFirst).toBe(100);
      expect(result.steps[5].value).toBe(90);
    });

    it('should handle empty funnel stats', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.dailyFunnelStats.findMany).mockResolvedValue([]);

      const { getConversionFunnel } = await import('./analytics');
      const result = await getConversionFunnel(30);

      expect(result.totals.pageViews).toBe(0);
      expect(result.steps[0].conversionFromFirst).toBe(0);
    });
  });

  describe('getCohortAnalysis', () => {
    it('should group users by registration month and calculate retention', async () => {
      const { prisma } = await import('@/lib/prisma');
      const jan = new Date('2026-01-15');
      const feb = new Date('2026-02-10');

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 1, createdAt: jan },
        { id: 2, createdAt: jan },
        { id: 3, createdAt: feb },
      ] as never);

      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { userId: 1, createdAt: jan },
        { userId: 1, createdAt: feb },
        { userId: 3, createdAt: feb },
      ] as never);

      const { getCohortAnalysis } = await import('./analytics');
      const result = await getCohortAnalysis(6);

      expect(result).toHaveLength(2);
      const janCohort = result.find((r) => r.cohort === '2026-01');
      expect(janCohort?.totalUsers).toBe(2);
      expect(janCohort?.retention['2026-01']).toBe(50); // 1 out of 2
    });
  });

  describe('getABCAnalysis', () => {
    it('should classify products into A, B, C categories', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([
        { productId: 1, productCode: 'P1', productName: 'Product 1', _sum: { subtotal: 8000, quantity: 100 }, _count: 50 },
        { productId: 2, productCode: 'P2', productName: 'Product 2', _sum: { subtotal: 1500, quantity: 30 }, _count: 15 },
        { productId: 3, productCode: 'P3', productName: 'Product 3', _sum: { subtotal: 500, quantity: 10 }, _count: 5 },
      ] as never);

      const { getABCAnalysis } = await import('./analytics');
      const result = await getABCAnalysis(30);

      expect(result.summary.totalRevenue).toBe(10000);
      expect(result.summary.totalProducts).toBe(3);
      expect(result.products[0].category).toBe('A');
      expect(result.products[2].category).toBe('C');
    });

    it('should handle empty products', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([] as never);

      const { getABCAnalysis } = await import('./analytics');
      const result = await getABCAnalysis(30);

      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.totalProducts).toBe(0);
      expect(result.products).toHaveLength(0);
    });

    it('should handle products with null subtotals', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([
        { productId: 1, productCode: 'P1', productName: 'Product 1', _sum: { subtotal: null, quantity: null }, _count: 1 },
      ] as never);

      const { getABCAnalysis } = await import('./analytics');
      const result = await getABCAnalysis(30);

      expect(result.summary.totalRevenue).toBe(0);
      expect(result.products[0].revenue).toBe(0);
      expect(result.products[0].quantity).toBe(0);
    });

    it('should classify B category correctly', async () => {
      const { prisma } = await import('@/lib/prisma');
      // Product 1: 80% revenue = A, Product 2: next 15% = B
      vi.mocked(prisma.orderItem.groupBy).mockResolvedValue([
        { productId: 1, productCode: 'P1', productName: 'Product 1', _sum: { subtotal: 800, quantity: 10 }, _count: 5 },
        { productId: 2, productCode: 'P2', productName: 'Product 2', _sum: { subtotal: 150, quantity: 3 }, _count: 2 },
        { productId: 3, productCode: 'P3', productName: 'Product 3', _sum: { subtotal: 50, quantity: 1 }, _count: 1 },
      ] as never);

      const { getABCAnalysis } = await import('./analytics');
      const result = await getABCAnalysis(30);

      expect(result.summary.A).toBe(1);
      expect(result.summary.B).toBe(1);
      expect(result.summary.C).toBe(1);
      expect(result.products[1].category).toBe('B');
    });
  });

  describe('AnalyticsError', () => {
    it('should create error with correct properties', async () => {
      const { AnalyticsError } = await import('./analytics');
      const error = new AnalyticsError('test', 400);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('test');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('AnalyticsError');
    });
  });

  describe('getCohortAnalysis - orders without userId', () => {
    it('should skip orders with null userId', async () => {
      const { prisma } = await import('@/lib/prisma');
      const jan = new Date('2026-01-15');

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 1, createdAt: jan },
      ] as never);

      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { userId: null, createdAt: jan },
        { userId: 1, createdAt: jan },
      ] as never);

      const { getCohortAnalysis } = await import('./analytics');
      const result = await getCohortAnalysis(6);

      expect(result).toHaveLength(1);
      expect(result[0].retention['2026-01']).toBe(100); // 1 out of 1
    });
  });

  describe('getCohortAnalysis - order with userId not in users list', () => {
    it('should skip orders where user is not found in user list', async () => {
      const { prisma } = await import('@/lib/prisma');
      const jan = new Date('2026-01-15');

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 1, createdAt: jan },
      ] as never);

      // userId=999 is not in users list
      vi.mocked(prisma.order.findMany).mockResolvedValue([
        { userId: 999, createdAt: jan },
        { userId: 1, createdAt: jan },
      ] as never);

      const { getCohortAnalysis } = await import('./analytics');
      const result = await getCohortAnalysis(6);

      expect(result).toHaveLength(1);
      expect(result[0].retention['2026-01']).toBe(100);
    });
  });

  describe('getCohortAnalysis - cohort with zero users for retention', () => {
    it('should handle default months parameter', async () => {
      const { prisma } = await import('@/lib/prisma');

      vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.order.findMany).mockResolvedValue([] as never);

      const { getCohortAnalysis } = await import('./analytics');
      const result = await getCohortAnalysis();

      expect(result).toEqual([]);
    });
  });

  describe('getConversionFunnel - zero previous step', () => {
    it('should return 0 conversionFromPrev when previous step has zero value', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.dailyFunnelStats.findMany).mockResolvedValue([
        {
          id: 1, date: new Date(), pageViews: 100, productViews: 0,
          addToCartCount: 0, cartViews: 0, checkoutStarts: 0,
          ordersCompleted: 0, totalRevenue: 0, uniqueVisitors: 50,
        },
      ] as never);

      const { getConversionFunnel } = await import('./analytics');
      const result = await getConversionFunnel(7);

      // step 2 (productViews=0) conversionFromPrev should be 0 because pageViews>0
      expect(result.steps[1].conversionFromPrev).toBe(0);
      // step 3 (addToCart=0) from productViews=0 -> 0
      expect(result.steps[2].conversionFromPrev).toBe(0);
    });
  });
});
