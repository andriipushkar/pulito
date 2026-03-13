import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { generateSecret, generateOtpauthUrl } from '@/services/totp';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * POST /api/v1/auth/2fa/setup
 * Generates a new TOTP secret for the authenticated admin/manager user.
 * The secret is stored but 2FA is NOT enabled until verified via /2fa/verify.
 */
export const POST = withRole('admin', 'manager')(async (_request, { user }) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!dbUser) {
      return errorResponse('Користувача не знайдено', 404);
    }

    if (dbUser.twoFactorEnabled) {
      return errorResponse('Двофакторна автентифікація вже увімкнена', 400);
    }

    const secret = generateSecret();
    const otpauthUrl = generateOtpauthUrl(secret, dbUser.email);

    // Store secret (not yet enabled)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });

    return successResponse({ secret, otpauthUrl });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
