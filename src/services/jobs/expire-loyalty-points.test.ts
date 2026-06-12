import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyLevel: { findMany: vi.fn() },
    loyaltyAccount: { findMany: vi.fn(), update: vi.fn() },
    loyaltyTransaction: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { expireLoyaltyPoints } from './expire-loyalty-points';

const mockPrisma = prisma as unknown as {
  loyaltyLevel: { findMany: ReturnType<typeof vi.fn> };
  loyaltyAccount: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  loyaltyTransaction: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockResolvedValue([]);
  mockPrisma.loyaltyTransaction.create.mockReturnValue({});
  mockPrisma.loyaltyAccount.update.mockReturnValue({});
});

function setup(oldTxns: { type: string; points: number }[], accountPoints: number) {
  mockPrisma.loyaltyLevel.findMany.mockResolvedValue([{ name: 'silver', pointsExpiryMonths: 12 }]);
  mockPrisma.loyaltyAccount.findMany.mockResolvedValue([
    { id: 1, userId: 10, points: accountPoints, level: 'silver' },
  ]);
  mockPrisma.loyaltyTransaction.findMany.mockResolvedValue(oldTxns);
}

function expiredPoints(): number | null {
  const txArgs = mockPrisma.$transaction.mock.calls[0]?.[0];
  if (!txArgs) return null;
  const createCall = mockPrisma.loyaltyTransaction.create.mock.calls[0]?.[0];
  return createCall?.data?.points ?? null;
}

describe('expireLoyaltyPoints', () => {
  it('expires the unspent old net (earn minus spend)', async () => {
    // Old window: earned 100, spent 60. Only 40 are still expirable.
    setup(
      [
        { type: 'earn', points: 100 },
        { type: 'spend', points: -60 }, // spend rows are stored NEGATIVE
      ],
      40,
    );

    const result = await expireLoyaltyPoints();

    expect(result.expired).toBe(40);
    expect(expiredPoints()).toBe(40);
  });

  it('does not burn recently-earned points when old spends are negative', async () => {
    // Regression: `net -= t.points` with a negative spend ADDED it back
    // (net = 100 + 60 = 160), so min(160, balance 90) wiped the recent 50 too.
    // Correct old net is 100 − 60 = 40.
    setup(
      [
        { type: 'earn', points: 100 },
        { type: 'spend', points: -60 },
      ],
      90, // 40 old + 50 recently earned
    );

    const result = await expireLoyaltyPoints();

    expect(result.expired).toBe(40);
    expect(expiredPoints()).toBe(40);
  });

  it('handles positive-stored deductions (expire, manual_deduct) the same way', async () => {
    // expire/manual_deduct rows are stored POSITIVE — both conventions must
    // reduce the expirable net.
    setup(
      [
        { type: 'earn', points: 100 },
        { type: 'expire', points: 30 },
        { type: 'manual_deduct', points: 20 },
      ],
      200,
    );

    const result = await expireLoyaltyPoints();

    expect(result.expired).toBe(50);
  });

  it('expires nothing when old window nets to zero or below', async () => {
    setup(
      [
        { type: 'earn', points: 50 },
        { type: 'spend', points: -50 },
      ],
      100,
    );

    const result = await expireLoyaltyPoints();

    expect(result.expired).toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('caps expiry at the current balance', async () => {
    setup([{ type: 'earn', points: 500 }], 120);

    const result = await expireLoyaltyPoints();

    expect(result.expired).toBe(120);
  });
});
