import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendDigestEmail } = vi.hoisted(() => ({
  mockSendDigestEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscriber: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));

vi.mock('../email-template', () => ({
  sendDigestEmail: mockSendDigestEmail,
}));

import { prisma } from '@/lib/prisma';
import { processDigestEmails } from './digest';

const mockPrisma = prisma as unknown as {
  subscriber: { findMany: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processDigestEmails', () => {
  it('should return early when no subscribers', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([]);
    const result = await processDigestEmails();
    expect(result).toEqual({ sent: 0, message: 'Немає підписників' });
  });

  it('should return early when no new products and no promo products', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([{ email: 'sub@test.com' }]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([]) // newProducts
      .mockResolvedValueOnce([]); // promoProducts

    const result = await processDigestEmails();
    expect(result).toEqual({ sent: 0, message: 'Немає нових товарів чи акцій для дайджесту' });
  });

  it('should send digest email with new products only', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([{ email: 'sub@test.com' }]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'New Prod', priceRetail: 200, slug: 'new-prod' }])
      .mockResolvedValueOnce([]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    const result = await processDigestEmails();

    expect(result).toEqual({ sent: 1, total: 1 });
    expect(mockSendDigestEmail).toHaveBeenCalledWith({
      to: 'sub@test.com',
      name: 'Шановний покупцю',
      newProducts: [{ name: 'New Prod', price: 200, slug: 'new-prod' }],
      promoProducts: [],
      period: expect.any(String),
    });
  });

  it('should send digest email with promo products only', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([{ email: 'sub@test.com' }]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'Promo Prod', priceRetail: 150, priceRetailOld: 200, slug: 'promo-prod' },
      ]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    const result = await processDigestEmails();

    expect(result).toEqual({ sent: 1, total: 1 });
    expect(mockSendDigestEmail.mock.calls[0][0].promoProducts).toEqual([
      { name: 'Promo Prod', price: 150, oldPrice: 200, slug: 'promo-prod' },
    ]);
  });

  it('should use priceRetail as oldPrice when priceRetailOld is null', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([{ email: 'sub@test.com' }]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'Promo', priceRetail: 100, priceRetailOld: null, slug: 'promo' },
      ]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    await processDigestEmails();

    expect(mockSendDigestEmail.mock.calls[0][0].promoProducts[0].oldPrice).toBe(100);
  });

  it('should send to multiple subscribers', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      { email: 'a@test.com' },
      { email: 'b@test.com' },
    ]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'P', priceRetail: 100, slug: 'p' }])
      .mockResolvedValueOnce([]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    const result = await processDigestEmails();
    expect(result).toEqual({ sent: 2, total: 2 });
    expect(mockSendDigestEmail).toHaveBeenCalledTimes(2);
  });

  it('should continue sending when one email fails', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      { email: 'a@test.com' },
      { email: 'b@test.com' },
    ]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'P', priceRetail: 100, slug: 'p' }])
      .mockResolvedValueOnce([]);
    mockSendDigestEmail
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    const result = await processDigestEmails();
    expect(result).toEqual({ sent: 1, total: 2 });
  });

  it('should include both new and promo products', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([{ email: 'sub@test.com' }]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ name: 'New', priceRetail: 100, slug: 'new' }])
      .mockResolvedValueOnce([{ name: 'Promo', priceRetail: 80, priceRetailOld: 100, slug: 'promo' }]);
    mockSendDigestEmail.mockResolvedValue(undefined);

    const result = await processDigestEmails();
    expect(result).toEqual({ sent: 1, total: 1 });
    const callData = mockSendDigestEmail.mock.calls[0][0];
    expect(callData.newProducts.length).toBe(1);
    expect(callData.promoProducts.length).toBe(1);
  });
});
