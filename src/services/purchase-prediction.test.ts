import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { findMany: vi.fn() },
    purchasePrediction: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/services/push', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/services/notification';
import { buildPredictions, processReminders } from './purchase-prediction';

const mockPrisma = prisma as unknown as {
  orderItem: { findMany: ReturnType<typeof vi.fn> };
  purchasePrediction: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
const mockCreateNotification = createNotification as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildPredictions', () => {
  it('should return 0 when no order items exist', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([]);

    const result = await buildPredictions();

    expect(result).toBe(0);
    expect(mockPrisma.purchasePrediction.upsert).not.toHaveBeenCalled();
  });

  it('should skip user-product pairs with fewer than 2 purchases', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-01') } },
    ]);

    const result = await buildPredictions();

    expect(result).toBe(0);
    expect(mockPrisma.purchasePrediction.upsert).not.toHaveBeenCalled();
  });

  it('should calculate correct average interval for 2 purchases', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-01') } },
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-31') } },
    ]);
    mockPrisma.purchasePrediction.upsert.mockResolvedValue({});

    const result = await buildPredictions();

    expect(result).toBe(1);
    const upsertCall = mockPrisma.purchasePrediction.upsert.mock.calls[0][0];
    // 30 days between Jan 1 and Jan 31
    expect(upsertCall.create.avgIntervalDays).toBe(30);
    expect(upsertCall.update.avgIntervalDays).toBe(30);
  });

  it('should calculate confidence as dataPoints / 5 capped at 1.0', async () => {
    // 2 purchases = 1 interval = confidence 0.2
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-01') } },
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-02-01') } },
    ]);
    mockPrisma.purchasePrediction.upsert.mockResolvedValue({});

    await buildPredictions();
    let upsertCall = mockPrisma.purchasePrediction.upsert.mock.calls[0][0];
    expect(upsertCall.create.confidence).toBeCloseTo(0.2); // 1 interval / 5

    vi.clearAllMocks();

    // 3 purchases = 2 intervals = confidence 0.4
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-01') } },
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-02-01') } },
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-03-01') } },
    ]);
    mockPrisma.purchasePrediction.upsert.mockResolvedValue({});

    await buildPredictions();
    upsertCall = mockPrisma.purchasePrediction.upsert.mock.calls[0][0];
    expect(upsertCall.create.confidence).toBeCloseTo(0.4); // 2 intervals / 5
  });

  it('should cap confidence at 1.0 for 6+ purchases', async () => {
    const dates = [
      new Date('2025-01-01'),
      new Date('2025-02-01'),
      new Date('2025-03-01'),
      new Date('2025-04-01'),
      new Date('2025-05-01'),
      new Date('2025-06-01'),
      new Date('2025-07-01'),
    ];
    mockPrisma.orderItem.findMany.mockResolvedValue(
      dates.map((d) => ({ productId: 1, order: { userId: 10, createdAt: d } })),
    );
    mockPrisma.purchasePrediction.upsert.mockResolvedValue({});

    await buildPredictions();
    const upsertCall = mockPrisma.purchasePrediction.upsert.mock.calls[0][0];
    expect(upsertCall.create.confidence).toBe(1); // 6 intervals / 5 = 1.2, capped at 1
  });

  it('should calculate correct predicted next date', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-01') } },
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-31') } },
    ]);
    mockPrisma.purchasePrediction.upsert.mockResolvedValue({});

    await buildPredictions();
    const upsertCall = mockPrisma.purchasePrediction.upsert.mock.calls[0][0];
    const predictedDate = upsertCall.create.predictedNextDate as Date;
    // Last purchase: Jan 31 + 30 days = Mar 2
    const expected = new Date('2025-01-31');
    expected.setTime(expected.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(predictedDate.getTime()).toBe(expected.getTime());
  });

  it('should handle multiple user-product pairs independently', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-01-01') } },
      { productId: 1, order: { userId: 10, createdAt: new Date('2025-02-01') } },
      { productId: 2, order: { userId: 10, createdAt: new Date('2025-01-01') } },
      { productId: 2, order: { userId: 10, createdAt: new Date('2025-03-01') } },
    ]);
    mockPrisma.purchasePrediction.upsert.mockResolvedValue({});

    const result = await buildPredictions();

    expect(result).toBe(2);
    expect(mockPrisma.purchasePrediction.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('processReminders', () => {
  it('should return 0 when no pending predictions exist', async () => {
    mockPrisma.purchasePrediction.findMany.mockResolvedValue([]);

    const result = await processReminders();

    expect(result).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('should only send for unsent predictions within range', async () => {
    const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    mockPrisma.purchasePrediction.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 10,
        productId: 1,
        predictedNextDate: tomorrow,
        notificationSent: false,
        product: { id: 1, name: 'Pulito', slug: 'poroshok', imagePath: null },
        user: { id: 10, fullName: 'Тест' },
      },
    ]);
    mockPrisma.purchasePrediction.update.mockResolvedValue({});

    const result = await processReminders(3);

    expect(result).toBe(1);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockPrisma.purchasePrediction.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notificationSent: true },
    });
  });

  it('should query with correct date range', async () => {
    mockPrisma.purchasePrediction.findMany.mockResolvedValue([]);

    await processReminders(5);

    const call = mockPrisma.purchasePrediction.findMany.mock.calls[0][0];
    expect(call.where.notificationSent).toBe(false);
    expect(call.where.predictedNextDate.gte).toBeInstanceOf(Date);
    expect(call.where.predictedNextDate.lte).toBeInstanceOf(Date);

    const diffMs =
      call.where.predictedNextDate.lte.getTime() - call.where.predictedNextDate.gte.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(5, 0);
  });

  it('should continue processing after individual failures', async () => {
    const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const predictions = [
      {
        id: 1,
        userId: 10,
        productId: 1,
        predictedNextDate: tomorrow,
        notificationSent: false,
        product: { id: 1, name: 'Pulito', slug: 'poroshok', imagePath: null },
        user: { id: 10, fullName: 'Тест' },
      },
      {
        id: 2,
        userId: 20,
        productId: 2,
        predictedNextDate: tomorrow,
        notificationSent: false,
        product: { id: 2, name: 'Мило', slug: 'mylo', imagePath: null },
        user: { id: 20, fullName: 'Тест 2' },
      },
    ];
    mockPrisma.purchasePrediction.findMany.mockResolvedValue(predictions);
    mockCreateNotification
      .mockRejectedValueOnce(new Error('Notification failed'))
      .mockResolvedValueOnce({});
    mockPrisma.purchasePrediction.update.mockResolvedValue({});

    const result = await processReminders(3);

    // First one fails, second succeeds
    expect(result).toBe(1);
    expect(mockPrisma.purchasePrediction.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.purchasePrediction.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { notificationSent: true },
    });
  });
});
