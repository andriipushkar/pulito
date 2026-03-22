import { prisma } from '@/lib/prisma';

const STREAK_WINDOW_DAYS = 30;

/**
 * Daily cron: update loyalty streaks.
 * Reset streaks for users who haven't ordered within the streak window.
 */
export async function processLoyaltyStreaks(): Promise<{ reset: number; active: number }> {
  const cutoff = new Date(Date.now() - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Reset broken streaks
  const resetResult = await prisma.loyaltyStreak.updateMany({
    where: {
      currentStreak: { gt: 0 },
      lastOrderDate: { lt: cutoff },
    },
    data: { currentStreak: 0 },
  });

  const activeCount = await prisma.loyaltyStreak.count({
    where: { currentStreak: { gt: 0 } },
  });

  return { reset: resetResult.count, active: activeCount };
}

/**
 * Called after order completion to update user's streak.
 */
export async function updateStreakOnOrder(userId: number): Promise<void> {
  const cutoff = new Date(Date.now() - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const streak = await prisma.loyaltyStreak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastOrderDate: new Date(),
    },
    update: {
      lastOrderDate: new Date(),
      currentStreak: {
        increment: 1,
      },
    },
  });

  // Update longest streak if needed
  if (streak.currentStreak > streak.longestStreak) {
    await prisma.loyaltyStreak.update({
      where: { userId },
      data: { longestStreak: streak.currentStreak },
    });
  }
}
