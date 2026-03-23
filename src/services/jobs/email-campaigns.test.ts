import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendWelcomeEmail, mockSendDigestEmail } = vi.hoisted(() => ({
  mockSendWelcomeEmail: vi.fn(),
  mockSendDigestEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));

vi.mock('../email-template', () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
  sendDigestEmail: mockSendDigestEmail,
}));

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://example.com' },
}));

import { prisma } from '@/lib/prisma';
import { processWelcomeEmails, processWeeklyDigest } from './email-campaigns';

const mockPrisma = prisma as unknown as {
  user: { findMany: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processWelcomeEmails', () => {
  it('should send welcome emails to verified users registered 24-48h ago', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'user@test.com', fullName: 'Test User' },
    ]);
    mockSendWelcomeEmail.mockResolvedValue(undefined);

    const result = await processWelcomeEmails();

    expect(result.sent).toBe(1);
    expect(result.total).toBe(1);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
      to: 'user@test.com',
      name: 'Test User',
    });
  });

  it('should query users with correct time window (24-48h ago, verified)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await processWelcomeEmails();

    const call = mockPrisma.user.findMany.mock.calls[0][0];
    expect(call.where.isVerified).toBe(true);

    const gteDate = call.where.createdAt.gte as Date;
    const lteDate = call.where.createdAt.lte as Date;

    // gte should be ~48h ago, lte should be ~24h ago
    const nowMs = Date.now();
    const gteDiff = nowMs - gteDate.getTime();
    const lteDiff = nowMs - lteDate.getTime();

    expect(gteDiff).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000 - 1000);
    expect(gteDiff).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 1000);
    expect(lteDiff).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(lteDiff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it('should return 0 when no new users found', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    const result = await processWelcomeEmails();
    expect(result.sent).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should continue processing when email send fails for one user', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 1, email: 'fail@test.com', fullName: 'Fail User' },
      { id: 2, email: 'ok@test.com', fullName: 'OK User' },
    ]);
    mockSendWelcomeEmail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    const result = await processWelcomeEmails();

    expect(result.sent).toBe(1);
    expect(result.total).toBe(2);
    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(2);
  });

  it('should limit to 50 users per batch', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await processWelcomeEmails();

    const call = mockPrisma.user.findMany.mock.calls[0][0];
    expect(call.take).toBe(50);
  });
});

describe('processWeeklyDigest', () => {
  it('should return early when no new products or promos exist', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const result = await processWeeklyDigest();

    expect(result.sent).toBe(0);
    expect(result.message).toBe('Немає нових товарів або акцій');
    expect(mockSendDigestEmail).not.toHaveBeenCalled();
  });

  it('should send digest email with new and promo products', async () => {
    // First call: newProducts, second call: promoProducts
    mockPrisma.product.findMany
      .mockResolvedValueOnce([
        { name: 'New Product', slug: 'new-product', priceRetail: 500 },
      ])
      .mockResolvedValueOnce([
        { name: 'Promo Product', slug: 'promo-product', priceRetail: 300, priceRetailOld: 400 },
      ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { email: 'user@test.com', fullName: 'Test User' },
    ]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    const result = await processWeeklyDigest();

    expect(result.sent).toBe(1);
    expect(mockSendDigestEmail).toHaveBeenCalledWith({
      to: 'user@test.com',
      name: 'Test User',
      newProducts: [{ name: 'New Product', slug: 'new-product', price: 500 }],
      promoProducts: [{ name: 'Promo Product', slug: 'promo-product', price: 300, oldPrice: 400 }],
      period: 'тиждень',
    });
  });

  it('should only send to verified, non-blocked users', async () => {
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'P', slug: 'p', priceRetail: 100 }])
      .mockResolvedValueOnce([]);

    mockPrisma.user.findMany.mockResolvedValue([]);
    await processWeeklyDigest();

    // Check the user query filters
    const userCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(userCall.where.isVerified).toBe(true);
    expect(userCall.where.isBlocked).toBe(false);
  });

  it('should limit to 500 users per batch', async () => {
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'P', slug: 'p', priceRetail: 100 }])
      .mockResolvedValueOnce([]);

    mockPrisma.user.findMany.mockResolvedValue([]);
    await processWeeklyDigest();

    const userCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(userCall.take).toBe(500);
  });

  it('should continue when one email fails and count only successful', async () => {
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'P', slug: 'p', priceRetail: 100 }])
      .mockResolvedValueOnce([]);

    mockPrisma.user.findMany.mockResolvedValue([
      { email: 'a@test.com', fullName: 'A' },
      { email: 'b@test.com', fullName: 'B' },
      { email: 'c@test.com', fullName: 'C' },
    ]);

    mockSendDigestEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const result = await processWeeklyDigest();

    expect(result.sent).toBe(2);
    expect(result.total).toBe(3);
  });

  it('should handle promo product without old price', async () => {
    mockPrisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'Promo', slug: 'promo', priceRetail: 300, priceRetailOld: null },
      ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { email: 'u@test.com', fullName: 'U' },
    ]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    await processWeeklyDigest();

    expect(mockSendDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        promoProducts: [{ name: 'Promo', slug: 'promo', price: 300, oldPrice: 0 }],
      }),
    );
  });
});
