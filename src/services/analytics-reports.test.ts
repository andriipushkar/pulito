import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    orderItem: { groupBy: vi.fn(), aggregate: vi.fn() },
    order: { groupBy: vi.fn() },
    priceHistory: { findMany: vi.fn() },
    channelVisit: { groupBy: vi.fn() },
    user: { findMany: vi.fn() },
    orderStatusHistory: { findMany: vi.fn() },
  },
}));

import {
  getStockAnalytics,
  getPriceAnalytics,
  getChannelAnalytics,
  getGeographyAnalytics,
  getCustomerLTV,
  getCustomerSegmentation,
  getOrderProcessingTime,
} from './analytics-reports';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getStockAnalytics
// ---------------------------------------------------------------------------
describe('getStockAnalytics', () => {
  async function setupMocks(products: object[], sales: object[], lastSales: object[]) {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as never);
    vi.mocked(prisma.orderItem.groupBy)
      .mockResolvedValueOnce(sales as never) // sales in period
      .mockResolvedValueOnce(lastSales as never); // last sale dates
  }

  it('should identify critical stock items (< 14 days until out)', async () => {
    const now = new Date();
    await setupMocks(
      [
        { id: 1, code: 'A1', name: 'Product A', quantity: 10 },
        { id: 2, code: 'B2', name: 'Product B', quantity: 100 },
      ],
      [
        { productId: 1, _sum: { quantity: 30 } }, // 1/day for 30-day period => 10 days left
        { productId: 2, _sum: { quantity: 3 } }, // 0.1/day => 1000 days left
      ],
      [
        { productId: 1, _max: { createdAt: now } },
        { productId: 2, _max: { createdAt: now } },
      ],
    );

    const result = await getStockAnalytics(30);

    expect(result.criticalStock).toHaveLength(1);
    expect(result.criticalStock[0].code).toBe('A1');
    expect(result.criticalStock[0].daysUntilOut).toBe(10);
    expect(result.summary.criticalCount).toBe(1);
  });

  it('should identify dead stock (no sales in 60+ days)', async () => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    await setupMocks(
      [{ id: 1, code: 'D1', name: 'Dead Product', quantity: 50 }],
      [],
      [{ productId: 1, _max: { createdAt: ninetyDaysAgo } }],
    );

    const result = await getStockAnalytics(30);

    expect(result.deadStock).toHaveLength(1);
    expect(result.deadStock[0].code).toBe('D1');
    expect(result.deadStock[0].daysSinceLastSale).toBeGreaterThanOrEqual(89);
    expect(result.summary.deadStockCount).toBe(1);
  });

  it('should include products with no sales ever as dead stock', async () => {
    await setupMocks([{ id: 1, code: 'NS1', name: 'Never Sold', quantity: 20 }], [], []);

    const result = await getStockAnalytics(30);

    expect(result.deadStock).toHaveLength(1);
    expect(result.deadStock[0].daysSinceLastSale).toBeNull();
  });

  it('should calculate turnover rates correctly', async () => {
    await setupMocks(
      [{ id: 1, code: 'T1', name: 'Turnover Item', quantity: 50 }],
      [{ productId: 1, _sum: { quantity: 100 } }],
      [{ productId: 1, _max: { createdAt: new Date() } }],
    );

    const result = await getStockAnalytics(30);

    expect(result.turnoverRates).toHaveLength(1);
    expect(result.turnoverRates[0].turnoverRate).toBe(2); // 100/50
    expect(result.turnoverRates[0].soldLast30).toBe(100);
  });

  it('should handle empty data', async () => {
    await setupMocks([], [], []);

    const result = await getStockAnalytics(30);

    expect(result.criticalStock).toHaveLength(0);
    expect(result.deadStock).toHaveLength(0);
    expect(result.turnoverRates).toHaveLength(0);
    expect(result.summary).toEqual({
      totalProducts: 0,
      criticalCount: 0,
      deadStockCount: 0,
      avgTurnover: 0,
    });
  });

  it('should exclude products with zero quantity from critical stock', async () => {
    await setupMocks(
      [{ id: 1, code: 'Z1', name: 'Zero Stock', quantity: 0 }],
      [{ productId: 1, _sum: { quantity: 50 } }],
      [{ productId: 1, _max: { createdAt: new Date() } }],
    );

    const result = await getStockAnalytics(30);

    expect(result.criticalStock).toHaveLength(0);
  });

  it('should use default 30-day period', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.orderItem.groupBy)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    await getStockAnalytics();

    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
  });

  it('should limit results to 50 items per list', async () => {
    const products = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      code: `P${i}`,
      name: `Product ${i}`,
      quantity: 5,
    }));
    const sales = products.map((p) => ({
      productId: p.id,
      _sum: { quantity: 30 },
    }));
    const lastSales = products.map((p) => ({
      productId: p.id,
      _max: { createdAt: new Date() },
    }));

    await setupMocks(products, sales, lastSales);

    const result = await getStockAnalytics(30);

    expect(result.criticalStock.length).toBeLessThanOrEqual(50);
    expect(result.turnoverRates.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// getPriceAnalytics
// ---------------------------------------------------------------------------
describe('getPriceAnalytics', () => {
  it('should return price changes with calculated percentage', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.priceHistory.findMany).mockResolvedValue([
      {
        productId: 1,
        product: { name: 'Test Product', code: 'TP1' },
        priceRetailOld: 100,
        priceRetailNew: 120,
        changedAt: new Date(),
      },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    const result = await getPriceAnalytics(30);

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].changePercent).toBe(20);
    expect(result.summary.priceIncreases).toBe(1);
    expect(result.summary.priceDecreases).toBe(0);
  });

  it('should handle price decrease', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.priceHistory.findMany).mockResolvedValue([
      {
        productId: 1,
        product: { name: 'Sale Item', code: 'SI1' },
        priceRetailOld: 200,
        priceRetailNew: 150,
        changedAt: new Date(),
      },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    const result = await getPriceAnalytics(30);

    expect(result.changes[0].changePercent).toBe(-25);
    expect(result.summary.priceDecreases).toBe(1);
  });

  it('should handle zero old price (no division by zero)', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.priceHistory.findMany).mockResolvedValue([
      {
        productId: 1,
        product: { name: 'Free', code: 'F1' },
        priceRetailOld: 0,
        priceRetailNew: 100,
        changedAt: new Date(),
      },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    const result = await getPriceAnalytics(30);

    expect(result.changes[0].changePercent).toBe(0);
  });

  it('should calculate promo impact for promo products', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.priceHistory.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 1, name: 'Promo', code: 'PR1' },
    ] as never);
    vi.mocked(prisma.orderItem.aggregate)
      .mockResolvedValueOnce({ _sum: { quantity: 10, subtotal: 1000 }, _count: 10 } as never)
      .mockResolvedValueOnce({ _sum: { quantity: 20, subtotal: 2000 }, _count: 20 } as never);

    const result = await getPriceAnalytics(30);

    expect(result.promoImpact).toHaveLength(1);
    expect(result.promoImpact[0].avgSalesAfter).toBeGreaterThan(
      result.promoImpact[0].avgSalesBefore,
    );
    expect(result.promoImpact[0].salesLift).toBeGreaterThan(0);
  });

  it('should handle empty data', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.priceHistory.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    const result = await getPriceAnalytics(30);

    expect(result.changes).toHaveLength(0);
    expect(result.promoImpact).toHaveLength(0);
    expect(result.summary.avgChangePercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getChannelAnalytics
// ---------------------------------------------------------------------------
describe('getChannelAnalytics', () => {
  it('should return channel analytics with conversion rates', async () => {
    const { prisma } = await import('@/lib/prisma');
    // bySource
    vi.mocked(prisma.order.groupBy)
      .mockResolvedValueOnce([{ source: 'web', _count: 50, _sum: { totalAmount: 10000 } }] as never)
      // byUtmSource
      .mockResolvedValueOnce([
        { utmSource: 'google', _count: 30, _sum: { totalAmount: 6000 } },
      ] as never)
      // byUtmMedium
      .mockResolvedValueOnce([
        { utmMedium: 'cpc', _count: 20, _sum: { totalAmount: 4000 } },
      ] as never)
      // byUtmCampaign
      .mockResolvedValueOnce([
        { utmCampaign: 'spring_sale', _count: 10, _sum: { totalAmount: 2000 } },
      ] as never);

    // channelVisits
    vi.mocked(prisma.channelVisit.groupBy)
      .mockResolvedValueOnce([{ utmSource: 'google', _count: 1000 }] as never)
      // channelConversions
      .mockResolvedValueOnce([{ utmSource: 'google', _count: 30 }] as never);

    const result = await getChannelAnalytics(30);

    expect(result.bySource).toHaveLength(1);
    expect(result.bySource[0].source).toBe('web');
    expect(result.byUtmSource).toHaveLength(1);
    expect(result.channelConversionRates).toHaveLength(1);
    expect(result.channelConversionRates[0].conversionRate).toBe(3);
  });

  it('should handle empty data', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.channelVisit.groupBy).mockResolvedValue([] as never);

    const result = await getChannelAnalytics(30);

    expect(result.bySource).toHaveLength(0);
    expect(result.channelConversionRates).toHaveLength(0);
  });

  it('should label null utm source as direct', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.channelVisit.groupBy)
      .mockResolvedValueOnce([{ utmSource: null, _count: 100 }] as never)
      .mockResolvedValueOnce([{ utmSource: null, _count: 5 }] as never);

    const result = await getChannelAnalytics(30);

    expect(result.channelConversionRates[0].source).toBe('direct');
  });
});

// ---------------------------------------------------------------------------
// getGeographyAnalytics
// ---------------------------------------------------------------------------
describe('getGeographyAnalytics', () => {
  it('should return city-level geography analytics', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy)
      .mockResolvedValueOnce([
        { deliveryCity: 'Kyiv', _count: { _all: 100 }, _sum: { totalAmount: 50000 } },
        { deliveryCity: 'Lviv', _count: { _all: 50 }, _sum: { totalAmount: 20000 } },
      ] as never)
      .mockResolvedValueOnce([
        { deliveryMethod: 'nova_poshta', _count: { _all: 120 }, _sum: { totalAmount: 60000 } },
      ] as never);

    const result = await getGeographyAnalytics(30);

    expect(result.cities).toHaveLength(2);
    expect(result.topCity?.city).toBe('Kyiv');
    expect(result.totalOrders).toBe(150);
    expect(result.totalRevenue).toBe(70000);
    expect(result.cities[0].ordersPercent).toBeGreaterThan(0);
    expect(result.byDeliveryMethod).toHaveLength(1);
  });

  it('should handle empty data', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);

    const result = await getGeographyAnalytics(30);

    expect(result.cities).toHaveLength(0);
    expect(result.topCity).toBeNull();
    expect(result.totalOrders).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCustomerLTV
// ---------------------------------------------------------------------------
describe('getCustomerLTV', () => {
  it('should calculate customer LTV metrics', async () => {
    const { prisma } = await import('@/lib/prisma');
    const firstDate = new Date('2025-01-01');
    const lastDate = new Date('2025-06-01');

    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      {
        userId: 1,
        _sum: { totalAmount: 10000 },
        _count: 5,
        _min: { createdAt: firstDate },
        _max: { createdAt: lastDate },
      },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 1,
        email: 'user@test.com',
        fullName: 'Test User',
        companyName: null,
        createdAt: firstDate,
      },
    ] as never);

    const result = await getCustomerLTV(365);

    expect(result.topCustomers).toHaveLength(1);
    expect(result.topCustomers[0].totalSpent).toBe(10000);
    expect(result.topCustomers[0].orderCount).toBe(5);
    expect(result.topCustomers[0].avgCheck).toBe(2000);
    expect(result.summary.totalCustomers).toBe(1);
    expect(result.distribution).toHaveLength(5);
  });

  it('should handle empty data', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const result = await getCustomerLTV(365);

    expect(result.topCustomers).toHaveLength(0);
    expect(result.summary.totalCustomers).toBe(0);
    expect(result.summary.avgLTV).toBe(0);
    expect(result.summary.medianLTV).toBe(0);
  });

  it('should filter out null userId entries', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      {
        userId: null,
        _sum: { totalAmount: 500 },
        _count: 1,
        _min: { createdAt: new Date() },
        _max: { createdAt: new Date() },
      },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const result = await getCustomerLTV(365);

    expect(result.topCustomers).toHaveLength(0);
    expect(result.summary.totalCustomers).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCustomerSegmentation
// ---------------------------------------------------------------------------
describe('getCustomerSegmentation', () => {
  it('should segment customers based on recency and frequency', async () => {
    const { prisma } = await import('@/lib/prisma');
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);
    const hundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const twoHundredDaysAgo = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
    const fourHundredDaysAgo = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      // champion: last order 10 days ago, 5+ orders
      { userId: 1, _sum: { totalAmount: 50000 }, _count: 6, _max: { createdAt: tenDaysAgo } },
      // loyal: last order 50 days ago, 3+ orders
      { userId: 2, _sum: { totalAmount: 20000 }, _count: 4, _max: { createdAt: fiftyDaysAgo } },
      // new: last order 10 days ago, 1 order
      { userId: 3, _sum: { totalAmount: 500 }, _count: 1, _max: { createdAt: tenDaysAgo } },
      // promising: 100 days ago, 2 orders
      { userId: 4, _sum: { totalAmount: 3000 }, _count: 2, _max: { createdAt: hundredDaysAgo } },
      // sleeping: 200 days ago
      { userId: 5, _sum: { totalAmount: 1000 }, _count: 1, _max: { createdAt: twoHundredDaysAgo } },
      // lost: 400 days ago
      { userId: 6, _sum: { totalAmount: 500 }, _count: 1, _max: { createdAt: fourHundredDaysAgo } },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 1, email: 'champion@test.com', fullName: 'Champion' },
      { id: 2, email: 'loyal@test.com', fullName: 'Loyal' },
      { id: 3, email: 'new@test.com', fullName: 'New Customer' },
      { id: 4, email: 'promising@test.com', fullName: 'Promising' },
      { id: 5, email: 'sleeping@test.com', fullName: 'Sleeping' },
      { id: 6, email: 'lost@test.com', fullName: 'Lost' },
    ] as never);

    const result = await getCustomerSegmentation();

    expect(result.totalCustomers).toBe(6);
    const segmentMap = new Map(result.segments.map((s) => [s.segment, s]));
    expect(segmentMap.get('champions')?.count).toBe(1);
    expect(segmentMap.get('loyal')?.count).toBe(1);
    expect(segmentMap.get('new')?.count).toBe(1);
    expect(segmentMap.get('lost')?.count).toBe(1);
  });

  it('should handle empty data', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const result = await getCustomerSegmentation();

    expect(result.totalCustomers).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.segments).toHaveLength(8); // all segment buckets present
  });

  it('should skip entries with null userId or null lastOrder date', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { userId: null, _sum: { totalAmount: 100 }, _count: 1, _max: { createdAt: new Date() } },
      { userId: 2, _sum: { totalAmount: 200 }, _count: 1, _max: { createdAt: null } },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const result = await getCustomerSegmentation();

    // Both should be skipped from segmentation
    const totalSegmented = result.segments.reduce((s, seg) => s + seg.count, 0);
    expect(totalSegmented).toBe(0);
  });

  it('should assign segment labels in Ukrainian', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const result = await getCustomerSegmentation();

    const labels = result.segments.map((s) => s.label);
    expect(labels).toContain('Чемпіони');
    expect(labels).toContain('Лояльні');
    expect(labels).toContain('Втрачені');
    expect(labels).toContain('Нові');
  });

  it('should limit customers list to 10 per segment', async () => {
    const { prisma } = await import('@/lib/prisma');
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const customers = Array.from({ length: 15 }, (_, i) => ({
      userId: i + 1,
      _sum: { totalAmount: 500 },
      _count: 1,
      _max: { createdAt: recentDate },
    }));

    vi.mocked(prisma.order.groupBy).mockResolvedValue(customers as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue(
      customers.map((c) => ({
        id: c.userId,
        email: `u${c.userId}@test.com`,
        fullName: null,
      })) as never,
    );

    const result = await getCustomerSegmentation();

    const newSegment = result.segments.find((s) => s.segment === 'new');
    expect(newSegment!.count).toBe(15);
    expect(newSegment!.customers.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// getOrderProcessingTime
// ---------------------------------------------------------------------------
describe('getOrderProcessingTime', () => {
  it('returns zero stats when no transitions in window', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.orderStatusHistory.findMany).mockResolvedValue([] as never);

    const result = await getOrderProcessingTime(30);

    expect(result.sampleSize).toBe(0);
    expect(result.avgHours).toBe(0);
  });

  it('computes avg/median/p95 across orders', async () => {
    const { prisma } = await import('@/lib/prisma');

    // First call: toStatus transitions
    // Second call: fromStatus transitions for those orders
    vi.mocked(prisma.orderStatusHistory.findMany)
      .mockResolvedValueOnce([
        { orderId: 1, createdAt: new Date('2026-04-01T10:00:00Z') },
        { orderId: 2, createdAt: new Date('2026-04-02T20:00:00Z') },
        { orderId: 3, createdAt: new Date('2026-04-03T08:00:00Z') },
      ] as never)
      .mockResolvedValueOnce([
        { orderId: 1, createdAt: new Date('2026-04-01T08:00:00Z') }, // 2h
        { orderId: 2, createdAt: new Date('2026-04-02T10:00:00Z') }, // 10h
        { orderId: 3, createdAt: new Date('2026-04-02T08:00:00Z') }, // 24h
      ] as never);

    const result = await getOrderProcessingTime(30);

    expect(result.sampleSize).toBe(3);
    expect(result.avgHours).toBe(12); // (2+10+24)/3
    expect(result.medianHours).toBe(10);
    expect(result.p95Hours).toBe(24);
  });

  it('skips transitions with no matching from-status', async () => {
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(prisma.orderStatusHistory.findMany)
      .mockResolvedValueOnce([
        { orderId: 1, createdAt: new Date('2026-04-01T10:00:00Z') },
        { orderId: 2, createdAt: new Date('2026-04-02T10:00:00Z') },
      ] as never)
      .mockResolvedValueOnce([
        { orderId: 1, createdAt: new Date('2026-04-01T08:00:00Z') }, // only order 1 has it
      ] as never);

    const result = await getOrderProcessingTime(30);

    expect(result.sampleSize).toBe(1);
  });

  it('passes through custom from/to statuses', async () => {
    const { prisma } = await import('@/lib/prisma');
    const findMock = vi.mocked(prisma.orderStatusHistory.findMany);
    findMock.mockResolvedValue([] as never);

    await getOrderProcessingTime(7, 'paid', 'completed');

    expect(findMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ newStatus: 'completed' }),
      }),
    );
  });
});
