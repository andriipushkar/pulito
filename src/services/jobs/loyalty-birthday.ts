import { prisma } from '@/lib/prisma';

const BIRTHDAY_BONUS_POINTS = 100;

/**
 * Daily cron: grant birthday bonus points to users whose birthday is today.
 * Only grants once per year (checks if bonus was already given this year).
 */
export async function processBirthdayBonuses(): Promise<{ granted: number }> {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  // Find users with birthday today who have a loyalty account
  const users = await prisma.user.findMany({
    where: {
      birthday: { not: null },
      isBlocked: false,
      loyaltyAccount: { isNot: null },
    },
    select: {
      id: true,
      birthday: true,
      loyaltyAccount: { select: { id: true } },
    },
  });

  let granted = 0;

  for (const user of users) {
    if (!user.birthday) continue;
    const bMonth = user.birthday.getMonth() + 1;
    const bDay = user.birthday.getDate();

    if (bMonth !== month || bDay !== day) continue;

    // Check if bonus already granted this year
    const existingBonus = await prisma.loyaltyTransaction.findFirst({
      where: {
        userId: user.id,
        type: 'birthday_bonus',
        createdAt: { gte: yearStart },
      },
    });

    if (existingBonus) continue;

    // Grant bonus
    await prisma.$transaction([
      prisma.loyaltyAccount.update({
        where: { userId: user.id },
        data: { points: { increment: BIRTHDAY_BONUS_POINTS } },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          userId: user.id,
          type: 'birthday_bonus',
          points: BIRTHDAY_BONUS_POINTS,
          description: `День народження — бонус ${BIRTHDAY_BONUS_POINTS} балів`,
        },
      }),
    ]);

    granted++;
  }

  return { granted };
}
