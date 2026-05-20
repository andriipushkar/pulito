import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// GET — security overview for the admin's user detail page:
//   - 2FA status
//   - block status + reason
//   - last 20 login attempts (successful + failed) for spot-checking unusual activity
export const GET = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const user = await prisma.user.findUnique({
      where: { id: numId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
      },
    });
    if (!user) return errorResponse('Користувача не знайдено', 404);

    const loginHistory = await prisma.loginHistory.findMany({
      where: { userId: numId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        device: true,
        browser: true,
        os: true,
        country: true,
        city: true,
        success: true,
        createdAt: true,
      },
    });

    // "Last login" = most recent successful entry. Fall back to null if the
    // user has never signed in (newly-created account).
    const lastLoginAt = loginHistory.find((l) => l.success)?.createdAt ?? null;

    return successResponse({
      user: {
        twoFactorEnabled: user.twoFactorEnabled,
        isBlocked: user.isBlocked,
        blockedAt: user.blockedAt,
        blockedReason: user.blockedReason,
        lastLoginAt,
      },
      loginHistory,
    });
  } catch (err) {
    logger.error('[admin/users/[id]/security] GET failed', { error: err });
    return errorResponse('Помилка завантаження', 500);
  }
});
