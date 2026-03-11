import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    loyaltyTransaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    loyaltyLevel: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as unknown as MockPrismaClient;

import {
  LoyaltyError,
  getOrCreateLoyaltyAccount,
  earnPoints,
  spendPoints,
  adjustPoints,
  recalculateLevel,
  getLoyaltyDashboard,
  getTransactionHistory,
  getLoyaltyLevels,
  updateLoyaltySettings,
} from './loyalty';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLevels = () => [
  { id: 1, name: 'bronze', minSpent: 0, pointsMultiplier: 1, discountPercent: 0, sortOrder: 0 },
  { id: 2, name: 'silver', minSpent: 5000, pointsMultiplier: 1.5, discountPercent: 3, sortOrder: 1 },
  { id: 3, name: 'gold', minSpent: 15000, pointsMultiplier: 2, discountPercent: 5, sortOrder: 2 },
];

const makeAccount = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 1,
  points: 100,
  totalSpent: 2000,
  level: 'bronze',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction just resolves (array-based usage)
  vi.mocked(mockPrisma.$transaction).mockResolvedValue(undefined as never);
});

// ---------------------------------------------------------------------------
// 1. LoyaltyError
// ---------------------------------------------------------------------------

describe('LoyaltyError', () => {
  it('should be an instance of Error with name and statusCode', () => {
    const err = new LoyaltyError('test message', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LoyaltyError');
    expect(err.message).toBe('test message');
    expect(err.statusCode).toBe(400);
  });

  it('should support different status codes', () => {
    const err = new LoyaltyError('not found', 404);
    expect(err.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 2. getOrCreateLoyaltyAccount
// ---------------------------------------------------------------------------

describe('getOrCreateLoyaltyAccount', () => {
  it('should return existing account when found', async () => {
    const existing = makeAccount();
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(existing as never);

    const result = await getOrCreateLoyaltyAccount(1);

    expect(result).toEqual(existing);
    expect(mockPrisma.loyaltyAccount.findUnique).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(mockPrisma.loyaltyAccount.create).not.toHaveBeenCalled();
  });

  it('should create a new account with 0 points and bronze level when not found', async () => {
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(null as never);
    const created = makeAccount({ points: 0, totalSpent: 0 });
    vi.mocked(mockPrisma.loyaltyAccount.create).mockResolvedValue(created as never);

    const result = await getOrCreateLoyaltyAccount(1);

    expect(result).toEqual(created);
    expect(mockPrisma.loyaltyAccount.create).toHaveBeenCalledWith({
      data: { userId: 1, points: 0, totalSpent: 0, level: 'bronze' },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. earnPoints
// ---------------------------------------------------------------------------

describe('earnPoints', () => {
  it('should calculate points with level multiplier and create transaction', async () => {
    const account = makeAccount({ level: 'silver', points: 50, totalSpent: 6000 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    const levels = makeLevels();
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(levels as never);

    // After earnPoints, recalculateLevel is called which also uses findUnique + findMany
    vi.mocked(mockPrisma.loyaltyAccount.update).mockResolvedValue(undefined as never);

    await earnPoints(1, 100, 500);

    // multiplier for silver = 1.5, so points = floor(500 * 1 * 1.5) = 750
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // The $transaction is called with an array of prisma operations
    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: {
        points: { increment: 750 },
        totalSpent: { increment: 500 },
      },
    });
    expect(mockPrisma.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        type: 'earn',
        points: 750,
        orderId: 100,
        description: expect.stringContaining('#100'),
      },
    });
  });

  it('should use multiplier of 1 when level is not found in levels list', async () => {
    const account = makeAccount({ level: 'unknown', points: 10, totalSpent: 100 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);
    vi.mocked(mockPrisma.loyaltyAccount.update).mockResolvedValue(undefined as never);

    await earnPoints(1, 200, 300);

    // multiplier defaults to 1, points = floor(300 * 1 * 1) = 300
    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: { increment: 300 },
        }),
      })
    );
  });

  it('should skip transaction when calculated points are 0', async () => {
    const account = makeAccount();
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);

    await earnPoints(1, 100, 0);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should call recalculateLevel after earning points', async () => {
    const account = makeAccount({ level: 'bronze', totalSpent: 4800 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    const levels = makeLevels();
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(levels as never);
    vi.mocked(mockPrisma.loyaltyAccount.update).mockResolvedValue(undefined as never);

    await earnPoints(1, 10, 250);

    // recalculateLevel calls findUnique and findMany again, plus update if level changed
    // findUnique: once for getOrCreate, once for recalculate = 2 calls total
    expect(mockPrisma.loyaltyAccount.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 4. spendPoints
// ---------------------------------------------------------------------------

describe('spendPoints', () => {
  it('should spend points and create a spend transaction', async () => {
    const account = makeAccount({ points: 200 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);

    await spendPoints(1, 100, 50);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { points: { decrement: 100 } },
    });
    expect(mockPrisma.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        type: 'spend',
        points: -100,
        orderId: 50,
        description: expect.stringContaining('#50'),
      },
    });
  });

  it('should throw LoyaltyError when insufficient points', async () => {
    const account = makeAccount({ points: 30 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);

    await expect(spendPoints(1, 100, 10)).rejects.toThrow(LoyaltyError);
    await expect(spendPoints(1, 100, 10)).rejects.toThrow(/30/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. adjustPoints
// ---------------------------------------------------------------------------

describe('adjustPoints', () => {
  it('should add points with manual_add type', async () => {
    const account = makeAccount({ points: 50 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);

    await adjustPoints({
      userId: 1,
      type: 'manual_add',
      points: 200,
      description: 'Bonus points',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { points: { increment: 200 } },
    });
    expect(mockPrisma.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        type: 'manual_add',
        points: 200,
        description: 'Bonus points',
      },
    });
  });

  it('should deduct points with manual_deduct type when sufficient', async () => {
    const account = makeAccount({ points: 300 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);

    await adjustPoints({
      userId: 1,
      type: 'manual_deduct',
      points: 100,
      description: 'Manual deduction',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { points: { increment: -100 } },
    });
    expect(mockPrisma.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        type: 'manual_deduct',
        points: -100,
        description: 'Manual deduction',
      },
    });
  });

  it('should throw LoyaltyError on manual_deduct when insufficient points', async () => {
    const account = makeAccount({ points: 20 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);

    await expect(
      adjustPoints({
        userId: 1,
        type: 'manual_deduct',
        points: 100,
        description: 'Too much',
      })
    ).rejects.toThrow(LoyaltyError);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. recalculateLevel
// ---------------------------------------------------------------------------

describe('recalculateLevel', () => {
  it('should update level when totalSpent qualifies for a higher level', async () => {
    const account = makeAccount({ level: 'bronze', totalSpent: 6000 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);
    vi.mocked(mockPrisma.loyaltyAccount.update).mockResolvedValue(undefined as never);

    await recalculateLevel(1);

    // totalSpent 6000 >= 5000 (silver) but < 15000 (gold), so new level = silver
    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { level: 'silver' },
    });
  });

  it('should not update when level is already correct', async () => {
    const account = makeAccount({ level: 'silver', totalSpent: 6000 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);

    await recalculateLevel(1);

    expect(mockPrisma.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('should do nothing when account is not found', async () => {
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(null as never);

    await recalculateLevel(999);

    expect(mockPrisma.loyaltyLevel.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('should do nothing when no levels exist', async () => {
    const account = makeAccount();
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue([] as never);

    await recalculateLevel(1);

    expect(mockPrisma.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('should assign the highest qualifying level (gold)', async () => {
    const account = makeAccount({ level: 'bronze', totalSpent: 20000 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);
    vi.mocked(mockPrisma.loyaltyAccount.update).mockResolvedValue(undefined as never);

    await recalculateLevel(1);

    expect(mockPrisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { level: 'gold' },
    });
  });
});

// ---------------------------------------------------------------------------
// 7. getLoyaltyDashboard
// ---------------------------------------------------------------------------

describe('getLoyaltyDashboard', () => {
  it('should return full dashboard data with account, currentLevel, nextLevel, and recentTransactions', async () => {
    const account = makeAccount({ level: 'silver', totalSpent: 7000 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    const levels = makeLevels();
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(levels as never);
    const transactions = [
      { id: 1, userId: 1, type: 'earn', points: 100, createdAt: new Date() },
    ];
    vi.mocked(mockPrisma.loyaltyTransaction.findMany).mockResolvedValue(transactions as never);

    const dashboard = await getLoyaltyDashboard(1);

    expect(dashboard.account).toEqual({
      id: 1,
      userId: 1,
      points: 100,
      totalSpent: 7000,
      level: 'silver',
    });
    expect(dashboard.currentLevel).toEqual({
      id: 2,
      name: 'silver',
      minSpent: 5000,
      pointsMultiplier: 1.5,
      discountPercent: 3,
      sortOrder: 1,
    });
    expect(dashboard.nextLevel).toEqual({
      id: 3,
      name: 'gold',
      minSpent: 15000,
      pointsMultiplier: 2,
      discountPercent: 5,
      sortOrder: 2,
    });
    expect(dashboard.recentTransactions).toEqual(transactions);
  });

  it('should return null for nextLevel when user is at the highest level', async () => {
    const account = makeAccount({ level: 'gold', totalSpent: 20000 });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);
    vi.mocked(mockPrisma.loyaltyTransaction.findMany).mockResolvedValue([] as never);

    const dashboard = await getLoyaltyDashboard(1);

    expect(dashboard.nextLevel).toBeNull();
    expect(dashboard.currentLevel!.name).toBe('gold');
  });

  it('should return null for currentLevel when level does not match any known level', async () => {
    const account = makeAccount({ level: 'platinum' });
    vi.mocked(mockPrisma.loyaltyAccount.findUnique).mockResolvedValue(account as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(makeLevels() as never);
    vi.mocked(mockPrisma.loyaltyTransaction.findMany).mockResolvedValue([] as never);

    const dashboard = await getLoyaltyDashboard(1);

    expect(dashboard.currentLevel).toBeNull();
    expect(dashboard.nextLevel).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. getTransactionHistory
// ---------------------------------------------------------------------------

describe('getTransactionHistory', () => {
  it('should return paginated transaction list', async () => {
    const items = [
      { id: 1, userId: 1, type: 'earn', points: 50, createdAt: new Date() },
      { id: 2, userId: 1, type: 'spend', points: -20, createdAt: new Date() },
    ];
    vi.mocked(mockPrisma.loyaltyTransaction.findMany).mockResolvedValue(items as never);
    vi.mocked(mockPrisma.loyaltyTransaction.count).mockResolvedValue(25 as never);

    const result = await getTransactionHistory(1, 2, 10);

    expect(result.items).toEqual(items);
    expect(result.total).toBe(25);
    expect(mockPrisma.loyaltyTransaction.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(mockPrisma.loyaltyTransaction.count).toHaveBeenCalledWith({ where: { userId: 1 } });
  });

  it('should compute skip correctly for page 1', async () => {
    vi.mocked(mockPrisma.loyaltyTransaction.findMany).mockResolvedValue([] as never);
    vi.mocked(mockPrisma.loyaltyTransaction.count).mockResolvedValue(0 as never);

    await getTransactionHistory(1, 1, 20);

    expect(mockPrisma.loyaltyTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

// ---------------------------------------------------------------------------
// 9. getLoyaltyLevels
// ---------------------------------------------------------------------------

describe('getLoyaltyLevels', () => {
  it('should return all levels ordered by sortOrder', async () => {
    const levels = makeLevels();
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(levels as never);

    const result = await getLoyaltyLevels();

    expect(result).toEqual(levels);
    expect(mockPrisma.loyaltyLevel.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('should return empty array when no levels exist', async () => {
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue([] as never);

    const result = await getLoyaltyLevels();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. updateLoyaltySettings
// ---------------------------------------------------------------------------

describe('updateLoyaltySettings', () => {
  it('should delete all existing levels and create new ones', async () => {
    vi.mocked(mockPrisma.loyaltyLevel.deleteMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(mockPrisma.loyaltyLevel.create).mockResolvedValue(undefined as never);
    const newLevels = [
      { name: 'starter', minSpent: 0, pointsMultiplier: 1, discountPercent: 0, sortOrder: 0 },
      { name: 'pro', minSpent: 10000, pointsMultiplier: 2, discountPercent: 10, sortOrder: 1 },
    ];
    const returnedLevels = newLevels.map((l, i) => ({ id: i + 1, ...l }));
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue(returnedLevels as never);

    const result = await updateLoyaltySettings(newLevels);

    expect(mockPrisma.loyaltyLevel.deleteMany).toHaveBeenCalledWith({});
    expect(mockPrisma.loyaltyLevel.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.loyaltyLevel.create).toHaveBeenCalledWith({
      data: {
        name: 'starter',
        minSpent: 0,
        pointsMultiplier: 1,
        discountPercent: 0,
        sortOrder: 0,
      },
    });
    expect(mockPrisma.loyaltyLevel.create).toHaveBeenCalledWith({
      data: {
        name: 'pro',
        minSpent: 10000,
        pointsMultiplier: 2,
        discountPercent: 10,
        sortOrder: 1,
      },
    });
    expect(result).toEqual(returnedLevels);
  });

  it('should handle empty levels array', async () => {
    vi.mocked(mockPrisma.loyaltyLevel.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(mockPrisma.loyaltyLevel.findMany).mockResolvedValue([] as never);

    const result = await updateLoyaltySettings([]);

    expect(mockPrisma.loyaltyLevel.deleteMany).toHaveBeenCalledWith({});
    expect(mockPrisma.loyaltyLevel.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
