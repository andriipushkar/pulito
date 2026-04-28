import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clientEvent: { findMany: vi.fn() },
    dailyFunnelStats: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { aggregateFunnelStats } from './funnel-aggregate';

const mockFindMany = vi.mocked(prisma.clientEvent.findMany);
const mockDeleteMany = vi.mocked(prisma.dailyFunnelStats.deleteMany);
const mockCreateMany = vi.mocked(prisma.dailyFunnelStats.createMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteMany.mockResolvedValue({ count: 0 } as never);
  mockCreateMany.mockResolvedValue({ count: 0 } as never);
});

describe('aggregateFunnelStats', () => {
  it('returns zero rows when no events', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await aggregateFunnelStats(new Date('2026-04-27'));
    expect(result.rowsWritten).toBe(0);
    expect(result.totalEvents).toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('aggregates events by device + traffic source', async () => {
    mockFindMany.mockResolvedValue([
      { eventType: 'page_view', sessionId: 's1', orderId: null, metadata: { device: 'mobile' } },
      { eventType: 'page_view', sessionId: 's2', orderId: null, metadata: { device: 'mobile' } },
      { eventType: 'product_view', sessionId: 's1', orderId: null, metadata: { device: 'mobile' } },
      { eventType: 'add_to_cart', sessionId: 's1', orderId: null, metadata: { device: 'desktop' } },
      {
        eventType: 'order_completed',
        sessionId: 's1',
        orderId: 7,
        metadata: { device: 'mobile', total: 250 },
      },
    ] as never);

    const result = await aggregateFunnelStats(new Date('2026-04-27'));

    expect(result.totalEvents).toBe(5);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockCreateMany).toHaveBeenCalledTimes(1);

    const args = mockCreateMany.mock.calls[0][0] as { data: Array<Record<string, unknown>> };
    const mobileRow = args.data.find((r) => r.deviceType === 'mobile');
    const desktopRow = args.data.find((r) => r.deviceType === 'desktop');

    expect(mobileRow).toMatchObject({
      pageViews: 2,
      productViews: 1,
      ordersCompleted: 1,
      totalRevenue: 250,
      uniqueVisitors: 2,
    });
    expect(desktopRow).toMatchObject({
      addToCartCount: 1,
      uniqueVisitors: 1,
    });
  });

  it('does not double-count the same orderId', async () => {
    mockFindMany.mockResolvedValue([
      {
        eventType: 'order_completed',
        sessionId: 's1',
        orderId: 1,
        metadata: { device: 'mobile', total: 100 },
      },
      {
        eventType: 'order_completed',
        sessionId: 's2',
        orderId: 1,
        metadata: { device: 'mobile', total: 100 },
      },
    ] as never);

    await aggregateFunnelStats(new Date('2026-04-27'));

    const args = mockCreateMany.mock.calls[0][0] as { data: Array<Record<string, unknown>> };
    expect(args.data[0]).toMatchObject({ ordersCompleted: 1, totalRevenue: 100 });
  });

  it('groups unknown device/traffic together', async () => {
    mockFindMany.mockResolvedValue([
      { eventType: 'page_view', sessionId: 's1', orderId: null, metadata: null },
    ] as never);

    await aggregateFunnelStats(new Date('2026-04-27'));

    const args = mockCreateMany.mock.calls[0][0] as { data: Array<Record<string, unknown>> };
    expect(args.data[0]).toMatchObject({
      deviceType: 'unknown',
      trafficSource: 'direct',
      pageViews: 1,
    });
  });
});
