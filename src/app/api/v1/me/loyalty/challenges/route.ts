import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const now = new Date();

    const challenges = await prisma.loyaltyChallenge.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user progress for each challenge
    const progress = await prisma.loyaltyChallengeProgress.findMany({
      where: {
        userId: user.id,
        challengeId: { in: challenges.map((c) => c.id) },
      },
    });

    const progressMap = new Map(progress.map((p) => [p.challengeId, p]));

    const result = challenges.map((c) => {
      const p = progressMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        target: c.target,
        reward: c.reward,
        currentValue: p?.currentValue ?? 0,
        isCompleted: !!p?.completedAt,
        isRewarded: !!p?.rewardedAt,
        endDate: c.endDate,
      };
    });

    return successResponse(result);
  } catch {
    return errorResponse('Помилка завантаження челенджів', 500);
  }
});
