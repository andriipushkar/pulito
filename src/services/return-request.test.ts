import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
    },
    returnRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  createReturnRequest,
  getUserReturns,
  getAdminReturns,
  processReturn,
  markReturnReceived,
  markReturnRefunded,
  ReturnError,
} from '@/services/return-request';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeOrder = (overrides?: Record<string, unknown>) => ({
  id: 1,
  userId: 10,
  status: 'completed',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
  items: [
    { id: 100, productName: 'Порошок А', quantity: 2, priceAtOrder: 150 },
    { id: 101, productName: 'Порошок Б', quantity: 1, priceAtOrder: 300 },
  ],
  ...overrides,
});

const makeReturnData = (overrides?: Record<string, unknown>) => ({
  orderId: 1,
  userId: 10,
  reason: 'defective',
  description: 'Товар пошкоджений',
  items: [{ orderItemId: 100, quantity: 1 }],
  ...overrides,
});

const makeReturnRequest = (overrides?: Record<string, unknown>) => ({
  id: 1,
  orderId: 1,
  userId: 10,
  reason: 'defective',
  status: 'requested',
  totalAmount: 150,
  createdAt: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// createReturnRequest
// ---------------------------------------------------------------------------

describe('createReturnRequest', () => {
  it('creates return request successfully', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder());
    mockPrisma.returnRequest.findFirst.mockResolvedValue(null);
    const created = makeReturnRequest();
    mockPrisma.returnRequest.create.mockResolvedValue(created);

    const result = await createReturnRequest(makeReturnData());
    expect(result).toEqual(created);
    expect(mockPrisma.returnRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        userId: 10,
        reason: 'defective',
        totalAmount: 150,
      }),
    });
  });

  it('throws 404 when order not found', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    await expect(createReturnRequest(makeReturnData())).rejects.toThrow(ReturnError);
    await expect(createReturnRequest(makeReturnData())).rejects.toThrow('не знайдено');
  });

  it('throws when order status is not completed or shipped', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'processing' }));

    await expect(createReturnRequest(makeReturnData())).rejects.toThrow('доставлених');
  });

  it('throws when 14-day return window has expired', async () => {
    const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20); // 20 days ago
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder({ createdAt: oldDate }));

    await expect(createReturnRequest(makeReturnData())).rejects.toThrow('14 днів');
  });

  it('throws when duplicate return request exists', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder());
    mockPrisma.returnRequest.findFirst.mockResolvedValue(makeReturnRequest());

    await expect(createReturnRequest(makeReturnData())).rejects.toThrow('вже існує');
  });

  it('throws when orderItemId not found in order', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder());
    mockPrisma.returnRequest.findFirst.mockResolvedValue(null);

    await expect(
      createReturnRequest(makeReturnData({ items: [{ orderItemId: 999, quantity: 1 }] }))
    ).rejects.toThrow('не знайдено');
  });

  it('throws when quantity exceeds ordered quantity', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder());
    mockPrisma.returnRequest.findFirst.mockResolvedValue(null);

    await expect(
      createReturnRequest(makeReturnData({ items: [{ orderItemId: 100, quantity: 10 }] }))
    ).rejects.toThrow('перевищує');
  });
});

// ---------------------------------------------------------------------------
// getUserReturns
// ---------------------------------------------------------------------------

describe('getUserReturns', () => {
  it('returns paginated user returns', async () => {
    const returns = [makeReturnRequest()];
    mockPrisma.returnRequest.findMany.mockResolvedValue(returns);
    mockPrisma.returnRequest.count.mockResolvedValue(1);

    const result = await getUserReturns(10, 1, 10);
    expect(result).toEqual({ returns, total: 1 });
    expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 10 }, skip: 0, take: 10 })
    );
  });
});

// ---------------------------------------------------------------------------
// getAdminReturns
// ---------------------------------------------------------------------------

describe('getAdminReturns', () => {
  it('returns all returns without status filter', async () => {
    mockPrisma.returnRequest.findMany.mockResolvedValue([]);
    mockPrisma.returnRequest.count.mockResolvedValue(0);

    await getAdminReturns(1, 20);
    expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('filters by status when provided', async () => {
    mockPrisma.returnRequest.findMany.mockResolvedValue([]);
    mockPrisma.returnRequest.count.mockResolvedValue(0);

    await getAdminReturns(1, 20, 'approved');
    expect(mockPrisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'approved' } })
    );
  });
});

// ---------------------------------------------------------------------------
// processReturn
// ---------------------------------------------------------------------------

describe('processReturn', () => {
  it('approves a return request', async () => {
    mockPrisma.returnRequest.findUnique.mockResolvedValue(makeReturnRequest());
    const updated = makeReturnRequest({ status: 'approved' });
    mockPrisma.returnRequest.update.mockResolvedValue(updated);

    const result = await processReturn(1, 'approved', 'Підтверджено', 5);
    expect(result).toEqual(updated);
    expect(mockPrisma.returnRequest.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ status: 'approved', processedBy: 5 }),
    });
  });

  it('rejects a return request', async () => {
    mockPrisma.returnRequest.findUnique.mockResolvedValue(makeReturnRequest());
    const updated = makeReturnRequest({ status: 'rejected' });
    mockPrisma.returnRequest.update.mockResolvedValue(updated);

    const result = await processReturn(1, 'rejected', 'Відхилено', 5);
    expect(result).toEqual(updated);
  });

  it('throws 404 when return request not found', async () => {
    mockPrisma.returnRequest.findUnique.mockResolvedValue(null);

    await expect(processReturn(999, 'approved', undefined, 5)).rejects.toThrow('не знайдено');
  });

  it('throws when return request already processed', async () => {
    mockPrisma.returnRequest.findUnique.mockResolvedValue(makeReturnRequest({ status: 'approved' }));

    await expect(processReturn(1, 'rejected', undefined, 5)).rejects.toThrow('вже оброблено');
  });
});

// ---------------------------------------------------------------------------
// markReturnReceived
// ---------------------------------------------------------------------------

describe('markReturnReceived', () => {
  it('marks return as received', async () => {
    const updated = makeReturnRequest({ status: 'received' });
    mockPrisma.returnRequest.update.mockResolvedValue(updated);

    const result = await markReturnReceived(1);
    expect(result).toEqual(updated);
    expect(mockPrisma.returnRequest.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'received' },
    });
  });
});

// ---------------------------------------------------------------------------
// markReturnRefunded
// ---------------------------------------------------------------------------

describe('markReturnRefunded', () => {
  it('marks return as refunded with timestamp', async () => {
    const updated = makeReturnRequest({ status: 'refunded' });
    mockPrisma.returnRequest.update.mockResolvedValue(updated);

    const result = await markReturnRefunded(1);
    expect(result).toEqual(updated);
    expect(mockPrisma.returnRequest.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'refunded', refundedAt: expect.any(Date) },
    });
  });
});
