import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const streak = await prisma.loyaltyStreak.findUnique({
      where: { userId: user.id },
    });

    return successResponse({
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastOrderDate: streak?.lastOrderDate,
    });
  } catch {
    return errorResponse('Помилка завантаження streak', 500);
  }
});
