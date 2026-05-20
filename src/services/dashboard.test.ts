import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import { getDashboardStats } from './dashboard';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    orderItem: {
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDashboardStats', () => {
  it('should return aggregated dashboard statistics', async () => {
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({ _count: 5, _sum: { totalAmount: 12500 } } as never)  // today
      .mockResolvedValueOnce({ _count: 3, _sum: { totalAmount: 8000 } } as never);  // yesterday
    mockPrisma.order.count.mockResolvedValue(2); // new orders
    mockPrisma.user.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(15)  // wholesalers
      .mockResolvedValueOnce(7)   // new this week
      .mockResolvedValueOnce(3);  // pending wholesale
    mockPrisma.product.count
      .mockResolvedValueOnce(200) // total
      .mockResolvedValueOnce(10)  // out of stock
      .mockResolvedValueOnce(4);  // low stock
    mockPrisma.orderItem.groupBy.mockResolvedValue([
      { productId: 1, _sum: { quantity: 50 } },
      { productId: 2, _sum: { quantity: 30 } },
    ] as never);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Product A', slug: 'product-a' },
      { id: 2, name: 'Product B', slug: 'product-b' },
    ] as never);
    mockPrisma.order.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          orderNumber: 'ORD-1',
          status: 'new_order',
          totalAmount: 100,
          contactName: 'Test',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ] as never)
      .mockResolvedValueOnce([] as never) // weekly orders
      .mockResolvedValueOnce([] as never); // today orders for hourly bucket

    const result = await getDashboardStats();

    expect(result.orders).toEqual({
      todayCount: 5,
      todayRevenue: 12500,
      yesterdayCount: 3,
      yesterdayRevenue: 8000,
      newCount: 2,
    });

    expect(result.users).toEqual({
      total: 100,
      wholesalers: 15,
      newThisWeek: 7,
      pendingWholesale: 3,
    });

    expect(result.products).toEqual({
      total: 200,
      outOfStock: 10,
      lowStock: 4,
    });

    expect(result.topProducts).toEqual([
      { id: 1, name: 'Product A', slug: 'product-a', quantity: 50 },
      { id: 2, name: 'Product B', slug: 'product-b', quantity: 30 },
    ]);

    expect(result.recentOrders).toHaveLength(1);
    expect(result.recentOrders[0].orderNumber).toBe('ORD-1');
    expect(result.weeklyRevenue).toHaveLength(7);
  });

  it('should handle zero revenue', async () => {
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({ _count: 0, _sum: { totalAmount: null } } as never)
      .mockResolvedValueOnce({ _count: 0, _sum: { totalAmount: null } } as never);
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.product.count.mockResolvedValue(0);
    mockPrisma.orderItem.groupBy.mockResolvedValue([] as never);
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    const result = await getDashboardStats();

    expect(result.orders.todayRevenue).toBe(0);
    expect(result.orders.yesterdayRevenue).toBe(0);
    expect(result.topProducts).toEqual([]);
    expect(result.recentOrders).toEqual([]);
  });

  it('should handle null quantity in top products', async () => {
    mockPrisma.order.aggregate.mockResolvedValue({ _count: 0, _sum: { totalAmount: null } } as never);
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.product.count.mockResolvedValue(0);
    mockPrisma.orderItem.groupBy.mockResolvedValue([
      { productId: 99, _sum: { quantity: null } },
    ] as never);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 99, name: 'Product X', slug: 'product-x' },
    ] as never);
    mockPrisma.order.findMany.mockResolvedValue([] as never);

    const result = await getDashboardStats();
    expect(result.topProducts[0].quantity).toBe(0);
  });
});
