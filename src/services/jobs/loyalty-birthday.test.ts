import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUserFindMany = vi.fn();
const mockLoyaltyTransactionFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
    loyaltyAccount: { update: vi.fn() },
    loyaltyTransaction: { findFirst: (...args: unknown[]) => mockLoyaltyTransactionFindFirst(...args), create: vi.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { processBirthdayBonuses } from './loyalty-birthday';

beforeEach(() => vi.clearAllMocks());

const today = new Date();

function makeUser(id: number, birthday: Date | null, isBlocked = false) {
  return {
    id,
    birthday,
    isBlocked,
    loyaltyAccount: { id: id * 10 },
  };
}

describe('processBirthdayBonuses', () => {
  it('grants bonus to users with birthday today', async () => {
    const birthdayToday = new Date(1990, today.getMonth(), today.getDate());
    mockUserFindMany.mockResolvedValue([makeUser(1, birthdayToday)]);
    mockLoyaltyTransactionFindFirst.mockResolvedValue(null); // no existing bonus
    mockTransaction.mockResolvedValue(undefined);

    const result = await processBirthdayBonuses();

    expect(result).toEqual({ granted: 1 });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('skips users who already received bonus this year', async () => {
    const birthdayToday = new Date(1990, today.getMonth(), today.getDate());
    mockUserFindMany.mockResolvedValue([makeUser(1, birthdayToday)]);
    mockLoyaltyTransactionFindFirst.mockResolvedValue({ id: 99 }); // already granted

    const result = await processBirthdayBonuses();

    expect(result).toEqual({ granted: 0 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('skips users whose birthday is not today', async () => {
    const differentDay = new Date(1990, today.getMonth(), today.getDate() === 1 ? 2 : 1);
    mockUserFindMany.mockResolvedValue([makeUser(1, differentDay)]);

    const result = await processBirthdayBonuses();

    expect(result).toEqual({ granted: 0 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('skips users with null birthday', async () => {
    mockUserFindMany.mockResolvedValue([makeUser(1, null)]);

    const result = await processBirthdayBonuses();

    expect(result).toEqual({ granted: 0 });
  });

  it('returns zero when no users found', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const result = await processBirthdayBonuses();

    expect(result).toEqual({ granted: 0 });
  });
});
