import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import crypto from 'crypto';
import type { ReferralFilterInput, GrantBonusInput } from '@/validators/referral';

export class ReferralError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ReferralError';
  }
}

const referralSelect = {
  id: true,
  referrerUserId: true,
  referrer: { select: { id: true, fullName: true, email: true } },
  referredUserId: true,
  referred: { select: { id: true, fullName: true, email: true } },
  referralCode: true,
  status: true,
  bonusType: true,
  bonusValue: true,
  createdAt: true,
  convertedAt: true,
} satisfies Prisma.ReferralSelect;

export function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function getUserReferralStats(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (!user) {
    throw new ReferralError('Користувача не знайдено', 404);
  }

  // Generate code if missing
  let referralCode = user.referralCode;
  if (!referralCode) {
    referralCode = generateReferralCode();
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    });
  }

  const referrals = await prisma.referral.findMany({
    where: { referrerUserId: userId },
    select: { status: true, bonusValue: true },
  });

  const totalReferred = referrals.length;
  const convertedCount = referrals.filter(
    (r) => r.status === 'first_order' || r.status === 'bonus_granted'
  ).length;
  const totalBonusValue = referrals
    .filter((r) => r.bonusValue)
    .reduce((sum, r) => sum + Number(r.bonusValue), 0);

  return {
    referralCode,
    referralLink: `${env.APP_URL}/auth/register?ref=${referralCode}`,
    totalReferred,
    convertedCount,
    totalBonusValue,
  };
}

export async function processReferral(referredUserId: number, code: string) {
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });

  if (!referrer) {
    return; // Silently skip invalid codes
  }

  if (referrer.id === referredUserId) {
    return; // Can't refer yourself
  }

  // Check if already referred
  const existing = await prisma.referral.findFirst({
    where: { referredUserId },
  });
  if (existing) return;

  await prisma.referral.create({
    data: {
      referrerUserId: referrer.id,
      referredUserId,
      referralCode: code,
      status: 'registered',
    },
  });
}

export async function getReferralStats() {
  const [byStatus, bonusAgg] = await Promise.all([
    prisma.referral.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.referral.aggregate({
      where: { status: 'bonus_granted' },
      _sum: { bonusValue: true },
    }),
  ]);

  const counts: Record<string, number> = {
    registered: 0,
    first_order: 0,
    bonus_granted: 0,
  };
  let total = 0;
  for (const row of byStatus) {
    counts[row.status] = row._count;
    total += row._count;
  }

  return {
    total,
    registered: counts.registered,
    firstOrder: counts.first_order,
    bonusGranted: counts.bonus_granted,
    bonusPaid: Number(bonusAgg._sum.bonusValue || 0),
  };
}

export async function getAllReferrals(filters: ReferralFilterInput) {
  const where: Prisma.ReferralWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.referrerId) where.referrerUserId = filters.referrerId;

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      select: referralSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
    }),
    prisma.referral.count({ where }),
  ]);

  return { items, total };
}

export async function grantReferralBonus(id: number, data: GrantBonusInput) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) {
    throw new ReferralError('Реферал не знайдено', 404);
  }
  if (referral.status === 'bonus_granted') {
    throw new ReferralError('Бонус уже видано', 409);
  }

  // Atomic claim: only grant if status is still a pre-bonus state. Prevents
  // two parallel admins from double-paying the referrer.
  const claimed = await prisma.referral.updateMany({
    where: { id, status: { in: ['registered', 'first_order'] } },
    data: {
      status: 'bonus_granted',
      bonusType: data.bonusType,
      bonusValue: data.bonusValue,
    },
  });
  if (claimed.count === 0) {
    throw new ReferralError('Бонус уже видано іншим адміністратором', 409);
  }

  return prisma.referral.findUniqueOrThrow({
    where: { id },
    select: referralSelect,
  });
}
