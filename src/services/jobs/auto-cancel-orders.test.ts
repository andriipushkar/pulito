import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/services/telegram', () => ({
  notifyClientStatusChange: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { notifyClientStatusChange } from '@/services/telegram';
import { autoCancelStaleOrders } from './auto-cancel-orders';

const mockPrisma = prisma as unknown as {
  order: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockNotifyClientStatusChange = notifyClientStatusChange as unknown as ReturnType<typeof vi.fn>;

async function flushAsyncCallbacks() {
  // Dynamic import() in the source creates a microtask chain:
  // 1. import() resolves -> 2. .then() fires notifyClientStatusChange -> 3. .catch()
  // We need enough ticks + a macrotask to let the full chain settle.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  await new Promise((r) => setTimeout(r, 50));
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

beforeEach(async () => {
  // Flush any lingering fire-and-forget promises from previous tests
  // before clearing mocks, so leaked callbacks don't pollute the next test.
  await flushAsyncCallbacks();
  vi.clearAllMocks();
});

describe('autoCancelStaleOrders', () => {
  it('should return 0 when no stale orders exist', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    const result = await autoCancelStaleOrders();
    expect(result).toBe(0);
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('should cancel stale orders and return count', async () => {
    const staleOrders = [
      { id: 1, orderNumber: 'ORD-001', userId: null },
      { id: 2, orderNumber: 'ORD-002', userId: null },
    ];
    mockPrisma.order.findMany.mockResolvedValue(staleOrders);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoCancelStaleOrders();

    expect(result).toBe(2);
    expect(mockPrisma.order.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'cancelled',
        cancelledReason: 'Автоматичне скасування: замовлення не оброблено протягом 72 годин',
        cancelledBy: 'system',
        statusHistory: {
          create: {
            oldStatus: 'new_order',
            newStatus: 'cancelled',
            changeSource: 'cron',
            comment: 'Автоматичне скасування через 72 години',
          },
        },
      },
    });
  });

  it('should trigger notification path when userId is present', async () => {
    const staleOrders = [{ id: 1, orderNumber: 'ORD-001', userId: 42 }];
    mockPrisma.order.findMany.mockResolvedValue(staleOrders);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoCancelStaleOrders();
    await flushAsyncCallbacks();

    expect(result).toBe(1);
    expect(mockNotifyClientStatusChange).toHaveBeenCalledWith(42, 'ORD-001', 'new_order', 'cancelled');
  });

  it('should skip notification when userId is null', async () => {
    const staleOrders = [{ id: 1, orderNumber: 'ORD-001', userId: null }];
    mockPrisma.order.findMany.mockResolvedValue(staleOrders);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await autoCancelStaleOrders();
    await flushAsyncCallbacks();

    expect(result).toBe(1);
    expect(mockNotifyClientStatusChange).not.toHaveBeenCalled();
  });

  it('should handle telegram notification failure gracefully', async () => {
    const staleOrders = [{ id: 1, orderNumber: 'ORD-001', userId: 42 }];
    mockPrisma.order.findMany.mockResolvedValue(staleOrders);
    mockPrisma.order.update.mockResolvedValue({});
    mockNotifyClientStatusChange.mockRejectedValue(new Error('Telegram down'));

    const result = await autoCancelStaleOrders();
    await flushAsyncCallbacks();

    expect(result).toBe(1);
  });

  it('should query with correct 72-hour cutoff', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    await autoCancelStaleOrders();

    const call = mockPrisma.order.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('new_order');
    const cutoff = call.where.createdAt.lt as Date;
    const expectedMs = 72 * 60 * 60 * 1000;
    const diff = Date.now() - cutoff.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });
});
