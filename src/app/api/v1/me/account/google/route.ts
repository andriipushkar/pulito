import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';

export const DELETE = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { googleId: true, passwordHash: true },
    });

    if (!dbUser) {
      return errorResponse('Користувача не знайдено', 404);
    }

    if (!dbUser.googleId) {
      return errorResponse('Google акаунт не підключено', 400);
    }

    if (!dbUser.passwordHash) {
      return errorResponse('Спочатку встановіть пароль для акаунту', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: null },
    });

    return successResponse({ message: "Google акаунт від'єднано" });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { googleId: true, passwordHash: true },
    });

    if (!dbUser) {
      return errorResponse('Користувача не знайдено', 404);
    }

    return privateResponse({
      hasGoogle: !!dbUser.googleId,
      hasPassword: !!dbUser.passwordHash,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
