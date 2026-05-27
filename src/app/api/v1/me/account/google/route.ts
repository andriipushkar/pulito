import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const DELETE = withAuth(async (request: NextRequest, { user }) => {
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

    // Removing the OAuth identity is a security event — it changes the set
    // of factors that can sign in to the account.
    await logAudit({
      userId: user.id,
      actionType: 'user_edit',
      entityType: 'user',
      entityId: user.id,
      details: { action: 'google_unlinked' },
      ipAddress: getClientIp(request),
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
