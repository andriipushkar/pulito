import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findMany: vi.fn(), update: vi.fn() },
    order: { update: vi.fn() },
  },
}));

vi.mock('@/services/order', () => ({
  createOrder: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { logger } from '@/lib/logger';
import { processSubscriptionOrders } from './process-subscriptions';

const mockPrisma = prisma as unknown as {
  subscription: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  order: { update: ReturnType<typeof vi.fn> };
};
const mockCreateOrder = createOrder as unknown as ReturnType<typeof vi.fn>;
const mockLogger = logger as unknown as {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 10,
    frequency: 'monthly',
    discountPercent: 0,
    deliveryMethod: 'nova_poshta',
    deliveryCity: 'Київ',
    deliveryAddress: 'вул. Тестова 1',
    paymentMethod: 'bank_transfer',
    items: [
      {
        quantity: 2,
        product: {
          id: 100,
          code: 'P100',
          name: 'Test Product',
          priceRetail: 500,
          quantity: 10,
          isActive: true,
          imagePath: 'img.jpg',
        },
      },
    ],
    user: {
      id: 10,
      fullName: 'Тест Юзер',
      email: 'test@example.com',
      phone: '+380501234567',
    },
    ...overrides,
  };
}

describe('processSubscriptionOrders', () => {
  it('should process due subscriptions and create orders', async () => {
    const sub = makeSubscription();
    mockPrisma.subscription.findMany.mockResolvedValue([sub]);
    mockCreateOrder.mockResolvedValue({ id: 50, orderNumber: 'ORD-050' });
    mockPrisma.subscription.update.mockResolvedValue({});

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });
    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockCreateOrder).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        contactName: 'Тест Юзер',
        contactPhone: '+380501234567',
        deliveryMethod: 'nova_poshta',
      }),
      expect.arrayContaining([
        expect.objectContaining({
          productId: 100,
          productCode: 'P100',
          price: 500,
          quantity: 2,
        }),
      ]),
      'retail',
    );
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ lastOrderId: 50 }),
      }),
    );
  });

  it('should skip subscriptions with no available products', async () => {
    const sub = makeSubscription({
      items: [
        {
          quantity: 2,
          product: {
            id: 101,
            code: 'P101',
            name: 'Inactive',
            priceRetail: 100,
            quantity: 5,
            isActive: false,
            imagePath: null,
          },
        },
      ],
    });
    mockPrisma.subscription.findMany.mockResolvedValue([sub]);

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should skip products with insufficient stock', async () => {
    const sub = makeSubscription({
      items: [
        {
          quantity: 100, // more than available
          product: {
            id: 102,
            code: 'P102',
            name: 'Low Stock',
            priceRetail: 50,
            quantity: 2,
            isActive: true,
            imagePath: null,
          },
        },
      ],
    });
    mockPrisma.subscription.findMany.mockResolvedValue([sub]);

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('should apply discount correctly', async () => {
    const sub = makeSubscription({ discountPercent: 10 });
    // priceRetail=500, quantity=2 -> itemsTotal=1000
    // discountAmount = Math.round(1000 * 10) / 100 = 100
    mockPrisma.subscription.findMany.mockResolvedValue([sub]);
    mockCreateOrder.mockResolvedValue({ id: 60, orderNumber: 'ORD-060' });
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({});

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 60 },
      data: {
        discountAmount: 100,
        totalAmount: 900,
      },
    });
  });

  it('should not apply discount when discountPercent is 0', async () => {
    const sub = makeSubscription({ discountPercent: 0 });
    mockPrisma.subscription.findMany.mockResolvedValue([sub]);
    mockCreateOrder.mockResolvedValue({ id: 70, orderNumber: 'ORD-070' });
    mockPrisma.subscription.update.mockResolvedValue({});

    await processSubscriptionOrders();

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('should update nextDeliveryAt based on frequency', async () => {
    const frequencies: Record<string, number> = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      bimonthly: 60,
    };

    for (const [freq, days] of Object.entries(frequencies)) {
      vi.clearAllMocks();
      const sub = makeSubscription({ id: 1, frequency: freq, discountPercent: 0 });
      mockPrisma.subscription.findMany.mockResolvedValue([sub]);
      mockCreateOrder.mockResolvedValue({ id: 80, orderNumber: 'ORD-080' });
      mockPrisma.subscription.update.mockResolvedValue({});

      await processSubscriptionOrders();

      const updateCall = mockPrisma.subscription.update.mock.calls[0][0];
      const nextDate = updateCall.data.nextDeliveryAt as Date;
      const expectedMs = days * 24 * 60 * 60 * 1000;
      const diff = nextDate.getTime() - Date.now();
      // Allow 2 second tolerance
      expect(diff).toBeGreaterThanOrEqual(expectedMs - 2000);
      expect(diff).toBeLessThanOrEqual(expectedMs + 2000);
    }
  });

  it('should handle createOrder failure gracefully', async () => {
    const sub = makeSubscription();
    mockPrisma.subscription.findMany.mockResolvedValue([sub]);
    mockCreateOrder.mockRejectedValue(new Error('Order creation failed'));

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('should return correct counts with mixed results', async () => {
    const goodSub = makeSubscription({ id: 1 });
    const noProductsSub = makeSubscription({
      id: 2,
      items: [
        {
          quantity: 1,
          product: { id: 200, code: 'X', name: 'Off', priceRetail: 10, quantity: 0, isActive: true, imagePath: null },
        },
      ],
    });
    const failSub = makeSubscription({ id: 3 });

    mockPrisma.subscription.findMany.mockResolvedValue([goodSub, noProductsSub, failSub]);
    mockCreateOrder
      .mockResolvedValueOnce({ id: 90, orderNumber: 'ORD-090' })
      .mockRejectedValueOnce(new Error('fail'));
    mockPrisma.subscription.update.mockResolvedValue({});

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 1, failed: 1, skipped: 1 });
  });

  it('should return zeros when no subscriptions are due', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const result = await processSubscriptionOrders();

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0 });
  });
});
