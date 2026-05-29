import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { verifyTOTP, decryptStoredSecret } from '@/services/totp';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const disableSchema = z.object({
  // Match the setup-verify schema — TOTP is strictly 6 digits. Tighter than
  // `min(1)` so oversize/garbage submissions get a 422 before reaching the
  // TOTP verifier.
  code: z.string().regex(/^\d{6}$/, 'Код має бути 6 цифр'),
});

/**
 * POST /api/v1/auth/2fa/disable
 * Disables 2FA for the authenticated user.
 * Requires a valid TOTP code to confirm the action.
 *
 * Roles mirror /2fa/setup + /2fa/verify so a customer who enabled 2FA
 * can also turn it off through their account security tab.
 */
export const POST = withRole(
  'admin',
  'manager',
  'client',
  'wholesaler',
)(async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = disableSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    // Rate limit by user ID
    const { redis } = await import('@/lib/redis');
    const rateLimitKey = `2fa_disable:${user.id}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 900);
    if (attempts > 5) {
      return errorResponse('Забагато спроб. Спробуйте через 15 хвилин.', 429);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!dbUser) {
      return errorResponse('Користувача не знайдено', 404);
    }

    if (!dbUser.twoFactorEnabled || !dbUser.twoFactorSecret) {
      return errorResponse('Двофакторна автентифікація не увімкнена', 400);
    }

    if (!verifyTOTP(decryptStoredSecret(dbUser.twoFactorSecret), parsed.data.code)) {
      return errorResponse('Невірний код. Спробуйте ще раз.', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    // Clear rate limit on success
    await redis.del(rateLimitKey);

    await logAudit({
      userId: user.id,
      actionType: 'user_edit',
      entityType: 'user',
      entityId: user.id,
      details: { action: '2fa_disabled' },
      ipAddress: getClientIp(request),
    });

    return successResponse({ twoFactorEnabled: false });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
