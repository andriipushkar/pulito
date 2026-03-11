import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendCartAbandonmentEmail } = vi.hoisted(() => ({
  mockSendCartAbandonmentEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: { groupBy: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../email-template', () => ({
  sendCartAbandonmentEmail: mockSendCartAbandonmentEmail,
}));

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://example.com' },
}));

import { prisma } from '@/lib/prisma';
import { processAbandonedCarts } from './cart-abandonment';

const mockPrisma = prisma as unknown as {
  cartItem: { groupBy: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processAbandonedCarts', () => {
  it('should return early when no abandoned carts', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([]);
    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 0, message: 'Немає покинутих кошиків' });
  });

  it('should use default 24 hours threshold', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([]);
    await processAbandonedCarts();

    const call = mockPrisma.cartItem.groupBy.mock.calls[0][0];
    const threshold = call.where.updatedAt.lt as Date;
    const expectedMs = 24 * 60 * 60 * 1000;
    const diff = Date.now() - threshold.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('should accept custom hours threshold', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([]);
    await processAbandonedCarts(48);

    const call = mockPrisma.cartItem.groupBy.mock.calls[0][0];
    const threshold = call.where.updatedAt.lt as Date;
    const expectedMs = 48 * 60 * 60 * 1000;
    const diff = Date.now() - threshold.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('should skip users without email', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }]);
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, fullName: 'Test' });

    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 0, total: 1 });
    expect(mockSendCartAbandonmentEmail).not.toHaveBeenCalled();
  });

  it('should skip when user not found (null)', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }]);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 0, total: 1 });
    expect(mockSendCartAbandonmentEmail).not.toHaveBeenCalled();
  });

  it('should skip when cart items are empty after query', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }]);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@test.com', fullName: 'User' });
    mockPrisma.cartItem.findMany.mockResolvedValue([]);

    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 0, total: 1 });
    expect(mockSendCartAbandonmentEmail).not.toHaveBeenCalled();
  });

  it('should send email for valid abandoned cart', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }]);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@test.com', fullName: 'John' });
    mockPrisma.cartItem.findMany.mockResolvedValue([
      { quantity: 2, product: { name: 'Product A', priceRetail: 100 } },
    ]);
    mockSendCartAbandonmentEmail.mockResolvedValue(undefined);

    const result = await processAbandonedCarts();

    expect(result).toEqual({ sent: 1, total: 1 });
    expect(mockSendCartAbandonmentEmail).toHaveBeenCalledWith({
      to: 'user@test.com',
      name: 'John',
      items: [{ name: 'Product A', quantity: 2, price: 100 }],
      cartUrl: 'https://example.com/cart',
    });
  });

  it('should process multiple users and count successful sends', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ email: 'a@test.com', fullName: 'A' })
      .mockResolvedValueOnce({ email: 'b@test.com', fullName: 'B' });
    mockPrisma.cartItem.findMany.mockResolvedValue([
      { quantity: 1, product: { name: 'Prod', priceRetail: 50 } },
    ]);
    mockSendCartAbandonmentEmail.mockResolvedValue(undefined);

    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 2, total: 2 });
  });

  it('should continue processing when email send fails', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ email: 'a@test.com', fullName: 'A' })
      .mockResolvedValueOnce({ email: 'b@test.com', fullName: 'B' });
    mockPrisma.cartItem.findMany.mockResolvedValue([
      { quantity: 1, product: { name: 'Prod', priceRetail: 50 } },
    ]);
    mockSendCartAbandonmentEmail
      .mockRejectedValueOnce(new Error('Email fail'))
      .mockResolvedValueOnce(undefined);

    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 1, total: 2 });
  });

  it('should handle error during user lookup gracefully', async () => {
    mockPrisma.cartItem.groupBy.mockResolvedValue([{ userId: 1 }]);
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 0, total: 1 });
  });
});
