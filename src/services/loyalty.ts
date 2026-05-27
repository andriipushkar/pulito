import { prisma } from '@/lib/prisma';
import type { AdjustPointsInput } from '@/validators/loyalty';

export class LoyaltyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'LoyaltyError';
  }
}

// Points earned per 1 UAH spent (base rate)
const BASE_POINTS_RATE = 1;

export async function getOrCreateLoyaltyAccount(userId: number) {
  let account = await prisma.loyaltyAccount.findUnique({ where: { userId } });

  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: { userId, points: 0, totalSpent: 0, level: 'bronze' },
    });
  }

  return account;
}

export async function earnPoints(userId: number, orderId: number, orderAmount: number) {
  const account = await getOrCreateLoyaltyAccount(userId);
  const levels = await getLoyaltyLevels();
  const currentLevel = levels.find((l) => l.name === account.level);
  const multiplier = currentLevel?.pointsMultiplier ?? 1;

  const pointsEarned = Math.floor(orderAmount * BASE_POINTS_RATE * multiplier);
  if (pointsEarned <= 0) return;

  // Recalculate inside the same transaction so a crash between the points
  // credit and the level update can't leave the account on a stale tier.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.loyaltyAccount.update({
      where: { userId },
      data: {
        points: { increment: pointsEarned },
        totalSpent: { increment: orderAmount },
      },
    });
    await tx.loyaltyTransaction.create({
      data: {
        userId,
        type: 'earn',
        points: pointsEarned,
        orderId,
        description: `Нарахування за замовлення #${orderId}`,
      },
    });

    // Inline tier recalc against the same set of levels we read above.
    // Sort by minSpent ASC so an admin who reorders sortOrder doesn't drop
    // a user back to a lower tier when their totalSpent qualifies them for
    // a higher one.
    if (levels.length > 0) {
      const totalSpent = Number(updated.totalSpent);
      const sortedByMinSpent = [...levels].sort((a, b) => Number(a.minSpent) - Number(b.minSpent));
      let newLevel = sortedByMinSpent[0];
      for (const level of sortedByMinSpent) {
        if (totalSpent >= Number(level.minSpent)) newLevel = level;
      }
      if (newLevel.name !== updated.level) {
        await tx.loyaltyAccount.update({
          where: { userId },
          data: { level: newLevel.name },
        });
      }
    }
  });
}

export async function spendPoints(userId: number, points: number, orderId: number) {
  await getOrCreateLoyaltyAccount(userId);

  // Atomic claim: only decrement when current balance is sufficient. Two
  // parallel spendPoints calls now serialise here — the loser sees count=0
  // and gets a proper error instead of letting the user "spend" 2× the same
  // points.
  const claimed = await prisma.loyaltyAccount.updateMany({
    where: { userId, points: { gte: points } },
    data: { points: { decrement: points } },
  });
  if (claimed.count === 0) {
    const current = await prisma.loyaltyAccount.findUnique({
      where: { userId },
      select: { points: true },
    });
    throw new LoyaltyError(`Недостатньо балів. Доступно: ${current?.points ?? 0}`, 400);
  }

  await prisma.loyaltyTransaction.create({
    data: {
      userId,
      type: 'spend',
      points: -points,
      orderId,
      description: `Списання за замовлення #${orderId}`,
    },
  });
}

export async function adjustPoints(data: AdjustPointsInput) {
  await getOrCreateLoyaltyAccount(data.userId);

  const pointsDelta = data.type === 'manual_add' ? data.points : -data.points;

  if (data.type === 'manual_deduct') {
    // Atomic deduct: refuse if balance would go negative.
    const claimed = await prisma.loyaltyAccount.updateMany({
      where: { userId: data.userId, points: { gte: data.points } },
      data: { points: { decrement: data.points } },
    });
    if (claimed.count === 0) {
      const current = await prisma.loyaltyAccount.findUnique({
        where: { userId: data.userId },
        select: { points: true },
      });
      throw new LoyaltyError(
        `Недостатньо балів для списання. Доступно: ${current?.points ?? 0}`,
        400,
      );
    }
  } else {
    await prisma.loyaltyAccount.update({
      where: { userId: data.userId },
      data: { points: { increment: pointsDelta } },
    });
  }

  await prisma.loyaltyTransaction.create({
    data: {
      userId: data.userId,
      type: data.type,
      points: pointsDelta,
      description: data.description,
    },
  });
}

export async function recalculateLevel(userId: number) {
  const account = await prisma.loyaltyAccount.findUnique({ where: { userId } });
  if (!account) return;

  const levels = await getLoyaltyLevels();
  if (levels.length === 0) return;

  // Find highest level where totalSpent >= minSpent
  const totalSpent = Number(account.totalSpent);
  let newLevel = levels[0]; // lowest level
  for (const level of levels) {
    if (totalSpent >= Number(level.minSpent)) {
      newLevel = level;
    }
  }

  if (newLevel.name !== account.level) {
    await prisma.loyaltyAccount.update({
      where: { userId },
      data: { level: newLevel.name },
    });
  }
}

export async function getLoyaltyDashboard(userId: number) {
  const account = await getOrCreateLoyaltyAccount(userId);
  const levels = await getLoyaltyLevels();

  const currentLevel = levels.find((l) => l.name === account.level) || null;
  const currentIdx = levels.findIndex((l) => l.name === account.level);
  const nextLevel =
    currentIdx >= 0 && currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null;

  const recentTransactions = await prisma.loyaltyTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const serializeLevel = (level: (typeof levels)[number]) => ({
    id: level.id,
    name: level.name,
    minSpent: Number(level.minSpent),
    pointsMultiplier: level.pointsMultiplier,
    discountPercent: Number(level.discountPercent),
    sortOrder: level.sortOrder,
  });

  return {
    account: {
      id: account.id,
      userId: account.userId,
      points: account.points,
      totalSpent: Number(account.totalSpent),
      level: account.level,
    },
    currentLevel: currentLevel ? serializeLevel(currentLevel) : null,
    nextLevel: nextLevel ? serializeLevel(nextLevel) : null,
    recentTransactions,
  };
}

export async function getTransactionHistory(userId: number, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.loyaltyTransaction.count({ where: { userId } }),
  ]);

  return { items, total };
}

export async function getLoyaltyLevels() {
  return prisma.loyaltyLevel.findMany({
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Aggregate loyalty program metrics for the admin overview widget.
 * Returns earn/spend/expire totals for the given window plus top 10
 * point holders. All amounts are integer point counts (1 point ≈ 1 ₴).
 */
export async function getLoyaltyStats(opts: { days?: number } = {}) {
  const days = opts.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const txGrouped = await prisma.loyaltyTransaction.groupBy({
    by: ['type'],
    where: { createdAt: { gte: since } },
    _sum: { points: true },
    _count: { _all: true },
  });

  let earned = 0;
  let spent = 0;
  let expired = 0;
  let adjusted = 0;
  for (const row of txGrouped) {
    const sum = row._sum.points || 0;
    if (row.type === 'earn') earned += sum;
    else if (row.type === 'spend') spent += sum;
    else if (row.type === 'expire') expired += sum;
    else if (row.type === 'manual_add' || row.type === 'manual_deduct') adjusted += sum;
  }

  // Top 10 holders — descending by current balance.
  const topHolders = await prisma.loyaltyAccount.findMany({
    where: { points: { gt: 0 } },
    orderBy: { points: 'desc' },
    take: 10,
    include: {
      user: { select: { id: true, email: true, fullName: true } },
    },
  });

  // Total liability — sum of all positive balances (this is what we'd owe
  // customers in discounts if they all redeemed today).
  const liability = await prisma.loyaltyAccount.aggregate({
    where: { points: { gt: 0 } },
    _sum: { points: true },
  });

  return {
    windowDays: days,
    earned,
    spent,
    expired,
    adjusted,
    totalLiability: liability._sum.points || 0,
    topHolders: topHolders.map((h) => ({
      userId: h.userId,
      email: h.user?.email ?? '',
      fullName: h.user?.fullName ?? '',
      points: h.points,
      level: h.level,
      totalSpent: Number(h.totalSpent),
    })),
  };
}

export async function updateLoyaltySettings(
  levels: {
    name: string;
    minSpent: number;
    pointsMultiplier: number;
    discountPercent: number;
    sortOrder: number;
  }[],
) {
  // Replace all levels atomically — a crash mid-loop would otherwise leave
  // an empty levels table, which makes recalculateLevel + earnPoints silently
  // fall back to a multiplier of 1 and ignore tier benefits entirely.
  await prisma.$transaction(async (tx) => {
    await tx.loyaltyLevel.deleteMany({});
    for (const level of levels) {
      await tx.loyaltyLevel.create({
        data: {
          name: level.name,
          minSpent: level.minSpent,
          pointsMultiplier: level.pointsMultiplier,
          discountPercent: level.discountPercent,
          sortOrder: level.sortOrder,
        },
      });
    }
  });

  return getLoyaltyLevels();
}
