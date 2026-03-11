import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    referral: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'http://localhost:3000' },
}));

describe('referral service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate referral code', async () => {
    const { generateReferralCode } = await import('./referral');
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
    expect(/^[A-F0-9]+$/.test(code)).toBe(true);
  });

  it('should throw on grant bonus for non-existent referral', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.referral.findUnique).mockResolvedValue(null);

    const { grantReferralBonus, ReferralError } = await import('./referral');
    await expect(
      grantReferralBonus(999, { bonusType: 'cashback', bonusValue: 50 })
    ).rejects.toThrow(ReferralError);
  });

  describe('ReferralError', () => {
    it('should create error with correct name and statusCode', async () => {
      const { ReferralError } = await import('./referral');
      const err = new ReferralError('test', 404);
      expect(err.message).toBe('test');
      expect(err.name).toBe('ReferralError');
      expect(err.statusCode).toBe(404);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('getUserReferralStats', () => {
    it('should throw when user not found', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { getUserReferralStats, ReferralError } = await import('./referral');
      await expect(getUserReferralStats(999)).rejects.toThrow(ReferralError);
    });

    it('should generate referral code if user has none', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ referralCode: null } as never);
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);
      vi.mocked(prisma.referral.findMany).mockResolvedValue([]);

      const { getUserReferralStats } = await import('./referral');
      const result = await getUserReferralStats(1);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(result.referralCode).toHaveLength(8);
      expect(result.referralLink).toContain('ref=');
      expect(result.totalReferred).toBe(0);
      expect(result.convertedCount).toBe(0);
      expect(result.totalBonusValue).toBe(0);
    });

    it('should use existing referral code', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ referralCode: 'ABCD1234' } as never);
      vi.mocked(prisma.referral.findMany).mockResolvedValue([]);

      const { getUserReferralStats } = await import('./referral');
      const result = await getUserReferralStats(1);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.referralCode).toBe('ABCD1234');
    });

    it('should calculate stats correctly with mixed referrals', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ referralCode: 'CODE1234' } as never);
      vi.mocked(prisma.referral.findMany).mockResolvedValue([
        { status: 'registered', bonusValue: null },
        { status: 'first_order', bonusValue: 100 },
        { status: 'bonus_granted', bonusValue: 200 },
      ] as never);

      const { getUserReferralStats } = await import('./referral');
      const result = await getUserReferralStats(1);

      expect(result.totalReferred).toBe(3);
      expect(result.convertedCount).toBe(2);
      expect(result.totalBonusValue).toBe(300);
    });
  });

  describe('processReferral', () => {
    it('should silently skip invalid referral code', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { processReferral } = await import('./referral');
      await processReferral(1, 'INVALID');

      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('should silently skip self-referral', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 5 } as never);

      const { processReferral } = await import('./referral');
      await processReferral(5, 'CODE');

      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('should skip if already referred', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.referral.findFirst).mockResolvedValue({ id: 99 } as never);

      const { processReferral } = await import('./referral');
      await processReferral(2, 'CODE');

      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('should create referral for valid new referral', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.referral.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.referral.create).mockResolvedValue({} as never);

      const { processReferral } = await import('./referral');
      await processReferral(2, 'CODE');

      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerUserId: 1,
          referredUserId: 2,
          referralCode: 'CODE',
          status: 'registered',
        },
      });
    });
  });

  describe('getAllReferrals', () => {
    it('should return items and total with filters', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.referral.findMany).mockResolvedValue([{ id: 1 }] as never);
      vi.mocked(prisma.referral.count).mockResolvedValue(1);

      const { getAllReferrals } = await import('./referral');
      const result = await getAllReferrals({ page: 1, limit: 10 });

      expect(result.items).toEqual([{ id: 1 }]);
      expect(result.total).toBe(1);
    });

    it('should apply status and referrerId filters', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.referral.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.referral.count).mockResolvedValue(0);

      const { getAllReferrals } = await import('./referral');
      await getAllReferrals({ page: 2, limit: 5, status: 'registered', referrerId: 10 });

      expect(prisma.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'registered', referrerUserId: 10 },
          skip: 5,
          take: 5,
        })
      );
    });
  });

  describe('grantReferralBonus', () => {
    it('should update referral with bonus data', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.referral.findUnique).mockResolvedValue({ id: 1 } as never);
      vi.mocked(prisma.referral.update).mockResolvedValue({ id: 1, status: 'bonus_granted' } as never);

      const { grantReferralBonus } = await import('./referral');
      const result = await grantReferralBonus(1, { bonusType: 'cashback', bonusValue: 50 });

      expect(result.status).toBe('bonus_granted');
      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'bonus_granted',
          bonusType: 'cashback',
          bonusValue: 50,
        },
        select: expect.any(Object),
      });
    });
  });
});
