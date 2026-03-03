import { prisma } from '@/lib/prisma';
import type { AdjustPointsInput } from '@/validators/loyalty';

export class LoyaltyError extends Error {
  constructor(
    message: string,
    public statusCode: number
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

  await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { userId },
      data: {
        points: { increment: pointsEarned },
        totalSpent: { increment: orderAmount },
      },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId,
        type: 'earn',
        points: pointsEarned,
        orderId,
        description: `Нарахування за замовлення #${orderId}`,
      },
    }),
  ]);

  // Recalculate level
  await recalculateLevel(userId);
}

export async function spendPoints(userId: number, points: number, orderId: number) {
  const account = await getOrCreateLoyaltyAccount(userId);

  if (account.points < points) {
    throw new LoyaltyError(`Недостатньо балів. Доступно: ${account.points}`, 400);
  }

  await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { userId },
      data: { points: { decrement: points } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId,
        type: 'spend',
        points: -points,
        orderId,
        description: `Списання за замовлення #${orderId}`,
      },
    }),
  ]);
}

export async function adjustPoints(data: AdjustPointsInput) {
  await getOrCreateLoyaltyAccount(data.userId);

  const pointsDelta = data.type === 'manual_add' ? data.points : -data.points;

  if (data.type === 'manual_deduct') {
    const account = await prisma.loyaltyAccount.findUnique({ where: { userId: data.userId } });
    if (account && account.points < data.points) {
      throw new LoyaltyError(`Недостатньо балів для списання. Доступно: ${account.points}`, 400);
    }
  }

  await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { userId: data.userId },
      data: { points: { increment: pointsDelta } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        userId: data.userId,
        type: data.type,
        points: pointsDelta,
        description: data.description,
      },
    }),
  ]);
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
  const nextLevel = currentIdx >= 0 && currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null;

  const recentTransactions = await prisma.loyaltyTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const serializeLevel = (level: typeof levels[number]) => ({
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

export async function getTransactionHistory(
  userId: number,
  page: number,
  limit: number
) {
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

export async function updateLoyaltySettings(
  levels: { name: string; minSpent: number; pointsMultiplier: number; discountPercent: number; sortOrder: number }[]
) {
  // Replace all levels
  await prisma.loyaltyLevel.deleteMany({});

  for (const level of levels) {
    await prisma.loyaltyLevel.create({
      data: {
        name: level.name,
        minSpent: level.minSpent,
        pointsMultiplier: level.pointsMultiplier,
        discountPercent: level.discountPercent,
        sortOrder: level.sortOrder,
      },
    });
  }

  return getLoyaltyLevels();
}
