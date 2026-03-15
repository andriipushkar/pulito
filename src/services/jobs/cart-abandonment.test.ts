import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendCartAbandonmentEmail } = vi.hoisted(() => ({
  mockSendCartAbandonmentEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn() },
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
  user: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processAbandonedCarts', () => {
  it('should return early when no abandoned carts', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const result = await processAbandonedCarts();
    expect(result).toEqual({ sent: 0, message: 'Немає покинутих кошиків' });
  });

  it('should use default 24 hours threshold', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await processAbandonedCarts();

    const call = mockPrisma.user.findMany.mock.calls[0][0];
    const threshold = call.where.cartItems.some.updatedAt.lt as Date;
    const expectedMs = 24 * 60 * 60 * 1000;
    const diff = Date.now() - threshold.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('should accept custom hours threshold', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await processAbandonedCarts(48);

    const call = mockPrisma.user.findMany.mock.calls[0][0];
    const threshold = call.where.cartItems.some.updatedAt.lt as Date;
    const expectedMs = 48 * 60 * 60 * 1000;
    const diff = Date.now() - threshold.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('should skip users without email', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: null, fullName: 'No Email', cartItems: [{ product: { name: 'Test', priceRetail: 100 }, quantity: 1 }] },
    ]);
    const result = await processAbandonedCarts();
    expect(result.sent).toBe(0);
    expect(mockSendCartAbandonmentEmail).not.toHaveBeenCalled();
  });

  it('should skip when cart items are empty', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'test@test.com', fullName: 'Test', cartItems: [] },
    ]);
    const result = await processAbandonedCarts();
    expect(result.sent).toBe(0);
  });

  it('should send email for valid abandoned cart', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 1,
        email: 'user@test.com',
        fullName: 'Test User',
        cartItems: [
          { product: { name: 'Product A', priceRetail: 100 }, quantity: 2 },
        ],
      },
    ]);
    mockSendCartAbandonmentEmail.mockResolvedValue(undefined);

    const result = await processAbandonedCarts();
    expect(result.sent).toBe(1);
    expect(mockSendCartAbandonmentEmail).toHaveBeenCalledWith({
      to: 'user@test.com',
      name: 'Test User',
      items: [{ name: 'Product A', quantity: 2, price: 100 }],
      cartUrl: 'https://example.com/cart',
    });
  });

  it('should process multiple users and count successful sends', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'a@test.com', fullName: 'A', cartItems: [{ product: { name: 'P1', priceRetail: 50 }, quantity: 1 }] },
      { id: 2, email: 'b@test.com', fullName: 'B', cartItems: [{ product: { name: 'P2', priceRetail: 75 }, quantity: 3 }] },
    ]);
    mockSendCartAbandonmentEmail.mockResolvedValue(undefined);

    const result = await processAbandonedCarts();
    expect(result.sent).toBe(2);
    expect(result.total).toBe(2);
  });

  it('should continue processing when email send fails', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'fail@test.com', fullName: 'Fail', cartItems: [{ product: { name: 'P1', priceRetail: 50 }, quantity: 1 }] },
      { id: 2, email: 'ok@test.com', fullName: 'OK', cartItems: [{ product: { name: 'P2', priceRetail: 75 }, quantity: 1 }] },
    ]);
    mockSendCartAbandonmentEmail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    const result = await processAbandonedCarts();
    expect(result.sent).toBe(1);
    expect(result.total).toBe(2);
  });
});
