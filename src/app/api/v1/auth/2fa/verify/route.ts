import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { verifyTOTP, generateBackupCodes, hashBackupCode } from '@/services/totp';
import { successResponse, errorResponse } from '@/utils/api-response';

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Код має бути 6 цифр'),
});

/**
 * POST /api/v1/auth/2fa/verify
 * Verifies a TOTP code against the stored (not yet enabled) secret.
 * If valid, enables 2FA for the user and returns backup codes.
 */
export const POST = withRole('admin', 'manager')(async (request, { user }) => {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    // Rate limit by user ID
    const { redis } = await import('@/lib/redis');
    const rateLimitKey = `2fa_setup_verify:${user.id}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 900);
    if (attempts > 5) {
      // Clean up unverified secret after too many failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: null },
      });
      return errorResponse('Забагато спроб. Почніть налаштування 2FA заново.', 429);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!dbUser) {
      return errorResponse('Користувача не знайдено', 404);
    }

    if (dbUser.twoFactorEnabled) {
      return errorResponse('Двофакторна автентифікація вже увімкнена', 400);
    }

    if (!dbUser.twoFactorSecret) {
      return errorResponse('Спочатку виконайте налаштування 2FA через /2fa/setup', 400);
    }

    if (!verifyTOTP(dbUser.twoFactorSecret, parsed.data.code)) {
      return errorResponse('Невірний код. Спробуйте ще раз.', 400);
    }

    // Generate backup codes
    const plainBackupCodes = generateBackupCodes();
    const hashedBackupCodes = plainBackupCodes.map(hashBackupCode);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    // Clear rate limit on success
    await redis.del(rateLimitKey);

    return successResponse({
      twoFactorEnabled: true,
      backupCodes: plainBackupCodes,
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
