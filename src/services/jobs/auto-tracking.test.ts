import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/services/nova-poshta', () => ({
  trackParcel: vi.fn(),
}));

vi.mock('@/services/telegram', () => ({
  notifyClientStatusChange: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { trackParcel } from '@/services/nova-poshta';
import { notifyClientStatusChange } from '@/services/telegram';
import { autoTrackDeliveries } from './auto-tracking';

const mockPrisma = prisma as unknown as {
  order: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockTrackParcel = trackParcel as unknown as ReturnType<typeof vi.fn>;
const mockNotify = notifyClientStatusChange as unknown as ReturnType<typeof vi.fn>;

async function flushAsyncCallbacks() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  await new Promise((r) => setTimeout(r, 50));
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('autoTrackDeliveries', () => {
  it('should return zeros when no shipped orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 0, updated: 0 });
  });

  it('should skip orders with null trackingNumber', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: null, userId: 1 },
    ]);
    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 1, updated: 0 });
    expect(mockTrackParcel).not.toHaveBeenCalled();
  });

  it('should update order to completed when StatusCode is 9', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 5 },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '9' }]);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoTrackDeliveries();

    expect(result).toEqual({ checked: 1, updated: 1 });
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'completed',
        statusHistory: {
          create: {
            oldStatus: 'shipped',
            newStatus: 'completed',
            changeSource: 'cron',
            comment: 'Автоматично: посилка доставлена (ТТН 123456)',
          },
        },
      },
    });
  });

  it('should update order to completed when StatusCode is 11', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: null },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '11' }]);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 1, updated: 1 });
  });

  it('should not update when StatusCode is not 9 or 11 (e.g. 4 - in transit)', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 1 },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '4' }]);

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 1, updated: 0 });
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('should not update when StatusCode is 10 (returned)', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 1 },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '10' }]);

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 1, updated: 0 });
  });

  it('should skip when tracking result is empty array', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 1 },
    ]);
    mockTrackParcel.mockResolvedValue([]);

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 1, updated: 0 });
  });

  it('should skip when status is undefined (first element falsy)', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 1 },
    ]);
    mockTrackParcel.mockResolvedValue([undefined]);

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 1, updated: 0 });
  });

  it('should trigger notification path when userId is present and delivered', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 42 },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '9' }]);
    mockPrisma.order.update.mockResolvedValue({});

    await autoTrackDeliveries();
    await flushAsyncCallbacks();

    expect(mockNotify).toHaveBeenCalledWith(42, 'ORD-1', 'shipped', 'completed', '123456');
  });

  it('should skip notification path when userId is null', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: null },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '9' }]);
    mockPrisma.order.update.mockResolvedValue({});

    await autoTrackDeliveries();
    await flushAsyncCallbacks();

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('should complete even if notification errors (fire-and-forget)', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '123456', userId: 42 },
    ]);
    mockTrackParcel.mockResolvedValue([{ StatusCode: '9' }]);
    mockPrisma.order.update.mockResolvedValue({});
    mockNotify.mockRejectedValue(new Error('fail'));

    const result = await autoTrackDeliveries();
    await flushAsyncCallbacks();

    expect(result).toEqual({ checked: 1, updated: 1 });
  });

  it('should continue processing when trackParcel throws', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '111', userId: 1 },
      { id: 2, orderNumber: 'ORD-2', trackingNumber: '222', userId: 2 },
    ]);
    mockTrackParcel.mockRejectedValueOnce(new Error('API down')).mockResolvedValueOnce([{ StatusCode: '9' }]);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 2, updated: 1 });
  });

  it('should process multiple orders', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, orderNumber: 'ORD-1', trackingNumber: '111', userId: 1 },
      { id: 2, orderNumber: 'ORD-2', trackingNumber: '222', userId: 2 },
      { id: 3, orderNumber: 'ORD-3', trackingNumber: '333', userId: 3 },
    ]);
    mockTrackParcel
      .mockResolvedValueOnce([{ StatusCode: '9' }])
      .mockResolvedValueOnce([{ StatusCode: '4' }])
      .mockResolvedValueOnce([{ StatusCode: '11' }]);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoTrackDeliveries();
    expect(result).toEqual({ checked: 3, updated: 2 });
  });
});
