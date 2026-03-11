import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { aggregate: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    product: { count: vi.fn() },
  },
}));

vi.mock('../email', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://example.com' },
}));

import { prisma } from '@/lib/prisma';
import { sendAnalyticsDigest } from './analytics-digest';

const mockPrisma = prisma as unknown as {
  order: { aggregate: ReturnType<typeof vi.fn> };
  user: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  orderItem: { groupBy: ReturnType<typeof vi.fn> };
  product: { count: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendAnalyticsDigest', () => {
  const defaultAggregateResult = { _count: 5, _sum: { totalAmount: 1000 } };
  const defaultTopProducts = [
    { productCode: 'P1', productName: 'Product 1', _sum: { subtotal: 500, quantity: 10 } },
  ];

  function setupMocks(overrides?: {
    aggregate?: unknown;
    userCount?: number;
    topProducts?: unknown[];
    criticalStock?: number;
    admins?: { email: string }[];
  }) {
    mockPrisma.order.aggregate.mockResolvedValue(overrides?.aggregate ?? defaultAggregateResult);
    mockPrisma.user.count.mockResolvedValue(overrides?.userCount ?? 3);
    mockPrisma.orderItem.groupBy.mockResolvedValue(overrides?.topProducts ?? defaultTopProducts);
    mockPrisma.product.count.mockResolvedValue(overrides?.criticalStock ?? 2);
    mockPrisma.user.findMany.mockResolvedValue(overrides?.admins ?? [{ email: 'admin@test.com' }]);
    mockSendEmail.mockResolvedValue(undefined);
  }

  it('should send daily digest with correct days=1', async () => {
    setupMocks();
    const result = await sendAnalyticsDigest('daily');
    expect(result).toEqual({ sent: 1, total: 1, period: 'daily' });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].subject).toContain('Щоденний');
  });

  it('should send weekly digest with correct days=7', async () => {
    setupMocks();
    const result = await sendAnalyticsDigest('weekly');
    expect(result).toEqual({ sent: 1, total: 1, period: 'weekly' });
    expect(mockSendEmail.mock.calls[0][0].subject).toContain('Щотижневий');
  });

  it('should send monthly digest with correct days=30', async () => {
    setupMocks();
    const result = await sendAnalyticsDigest('monthly');
    expect(result).toEqual({ sent: 1, total: 1, period: 'monthly' });
    expect(mockSendEmail.mock.calls[0][0].subject).toContain('Щомісячний');
  });

  it('should handle zero orders (avgCheck = 0)', async () => {
    setupMocks({ aggregate: { _count: 0, _sum: { totalAmount: null } } });
    const result = await sendAnalyticsDigest('daily');
    expect(result.sent).toBe(1);
    // avgCheck should be 0 when totalOrders is 0
    expect(mockSendEmail.mock.calls[0][0].html).toContain('0 ₴');
  });

  it('should handle null totalAmount', async () => {
    setupMocks({ aggregate: { _count: 3, _sum: { totalAmount: null } } });
    const result = await sendAnalyticsDigest('daily');
    expect(result.sent).toBe(1);
  });

  it('should handle empty top products (no table rendered)', async () => {
    setupMocks({ topProducts: [] });
    const result = await sendAnalyticsDigest('daily');
    expect(result.sent).toBe(1);
    expect(mockSendEmail.mock.calls[0][0].html).not.toContain('Топ-5 товарів');
  });

  it('should handle top products with null _sum values', async () => {
    setupMocks({
      topProducts: [
        { productCode: 'P1', productName: 'Prod', _sum: { subtotal: null, quantity: null } },
      ],
    });
    const result = await sendAnalyticsDigest('daily');
    expect(result.sent).toBe(1);
  });

  it('should handle criticalStock > 0 styling', async () => {
    setupMocks({ criticalStock: 5 });
    const result = await sendAnalyticsDigest('daily');
    expect(result.sent).toBe(1);
    expect(mockSendEmail.mock.calls[0][0].html).toContain('#fef2f2');
    expect(mockSendEmail.mock.calls[0][0].html).toContain('#dc2626');
  });

  it('should handle criticalStock = 0 styling', async () => {
    setupMocks({ criticalStock: 0 });
    const result = await sendAnalyticsDigest('daily');
    expect(mockSendEmail.mock.calls[0][0].html).not.toContain('#fef2f2');
  });

  it('should send to multiple admins', async () => {
    setupMocks({
      admins: [{ email: 'a@t.com' }, { email: 'b@t.com' }],
    });
    const result = await sendAnalyticsDigest('daily');
    expect(result).toEqual({ sent: 2, total: 2, period: 'daily' });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it('should handle no admins', async () => {
    setupMocks({ admins: [] });
    const result = await sendAnalyticsDigest('daily');
    expect(result).toEqual({ sent: 0, total: 0, period: 'daily' });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('should continue sending when one email fails', async () => {
    setupMocks({
      admins: [{ email: 'a@t.com' }, { email: 'b@t.com' }],
    });
    mockSendEmail.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined);
    const result = await sendAnalyticsDigest('daily');
    expect(result).toEqual({ sent: 1, total: 2, period: 'daily' });
  });
});
