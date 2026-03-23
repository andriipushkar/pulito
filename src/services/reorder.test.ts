import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const mockAddToCart = vi.fn();
vi.mock('@/services/cart', () => ({
  addToCart: (...args: unknown[]) => mockAddToCart(...args),
  CartError: class CartError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'CartError';
      this.statusCode = statusCode;
    }
  },
}));

import { prisma } from '@/lib/prisma';
import { reorderFromOrder, ReorderError } from './reorder';
import { CartError } from './cart';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 1,
  contactEmail: 'user@example.com',
  items: [
    { id: 1, productId: 10, productName: 'Товар А', quantity: 2 },
    { id: 2, productId: 20, productName: 'Товар Б', quantity: 1 },
  ],
  ...overrides,
});

describe('reorderFromOrder', () => {
  it('should add correct items to cart', async () => {
    const order = makeOrder();
    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockAddToCart.mockResolvedValue({} as never);

    const result = await reorderFromOrder(1, 1);

    expect(mockAddToCart).toHaveBeenCalledTimes(2);
    expect(mockAddToCart).toHaveBeenCalledWith(1, 10, 2);
    expect(mockAddToCart).toHaveBeenCalledWith(1, 20, 1);
    expect(result.added).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.added[0]).toEqual({
      productId: 10,
      productName: 'Товар А',
      quantity: 2,
    });
  });

  it('should skip out-of-stock products', async () => {
    const order = makeOrder();
    mockPrisma.order.findUnique.mockResolvedValue(order as never);

    mockAddToCart
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new CartError('Недостатньо товару. Доступно: 0 шт.', 400));

    const result = await reorderFromOrder(1, 1);

    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].productName).toBe('Товар Б');
    expect(result.skipped[0].reason).toContain('Недостатньо товару');
  });

  it('should reject if user does not own order', async () => {
    const order = makeOrder({ userId: 99, contactEmail: 'other@example.com' });
    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' } as never);

    await expect(reorderFromOrder(1, 1)).rejects.toThrow(ReorderError);
    await expect(reorderFromOrder(1, 1)).rejects.toThrow('Немає доступу до цього замовлення');
  });

  it('should allow reorder by email match for guest orders', async () => {
    const order = makeOrder({ userId: null, contactEmail: 'user@example.com' });
    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@example.com' } as never);
    mockAddToCart.mockResolvedValue({} as never);

    const result = await reorderFromOrder(1, 1);

    expect(result.added).toHaveLength(2);
  });

  it('should throw 404 when order not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    await expect(reorderFromOrder(999, 1)).rejects.toThrow(ReorderError);
    await expect(reorderFromOrder(999, 1)).rejects.toThrow('Замовлення не знайдено');
  });

  it('should skip items with null productId', async () => {
    const order = makeOrder({
      items: [
        { id: 1, productId: null, productName: 'Видалений товар', quantity: 1 },
        { id: 2, productId: 20, productName: 'Товар Б', quantity: 1 },
      ],
    });
    mockPrisma.order.findUnique.mockResolvedValue(order as never);
    mockAddToCart.mockResolvedValue({} as never);

    const result = await reorderFromOrder(1, 1);

    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('Товар більше не існує');
  });
});
