import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateMany = vi.fn();
const mockCount = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyStreak: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { processLoyaltyStreaks, updateStreakOnOrder } from './loyalty-streaks';

beforeEach(() => vi.clearAllMocks());

describe('processLoyaltyStreaks', () => {
  it('resets broken streaks and returns counts', async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });
    mockCount.mockResolvedValue(7);

    const result = await processLoyaltyStreaks();

    expect(result).toEqual({ reset: 3, active: 7 });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        currentStreak: { gt: 0 },
        lastOrderDate: { lt: expect.any(Date) },
      },
      data: { currentStreak: 0 },
    });
  });

  it('returns active count', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockCount.mockResolvedValue(15);

    const result = await processLoyaltyStreaks();

    expect(result.active).toBe(15);
    expect(mockCount).toHaveBeenCalledWith({
      where: { currentStreak: { gt: 0 } },
    });
  });
});

describe('updateStreakOnOrder', () => {
  it('creates streak for new user (upsert creates)', async () => {
    mockUpsert.mockResolvedValue({ currentStreak: 1, longestStreak: 1 });

    await updateStreakOnOrder(42);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: 42 },
      create: {
        userId: 42,
        currentStreak: 1,
        longestStreak: 1,
        lastOrderDate: expect.any(Date),
      },
      update: {
        lastOrderDate: expect.any(Date),
        currentStreak: { increment: 1 },
      },
    });
    // longestStreak not updated because current == longest
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('increments existing streak and updates longest', async () => {
    mockUpsert.mockResolvedValue({ currentStreak: 5, longestStreak: 3 });

    await updateStreakOnOrder(42);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId: 42 },
      data: { longestStreak: 5 },
    });
  });
});
