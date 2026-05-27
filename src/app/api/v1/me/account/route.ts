import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deleteAccount, AccountError } from '@/services/account';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const DELETE = withAuth(async (request: NextRequest, { user }) => {
  // Sensitive bucket (3 per 15 min) so a brute-force loop against the
  // password check can't ride the bcrypt compare ladder. DELETE is
  // irreversible — caps stop a stolen session from wiping the account
  // on the third password guess.
  const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
  if (!rl.allowed) {
    return errorResponse(
      `Забагато спроб. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
      429,
    );
  }

  let body: { password?: unknown } = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return errorResponse('Невалідне тіло запиту', 400);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, googleId: true, email: true },
  });

  if (!dbUser) {
    return errorResponse('Користувача не знайдено', 404);
  }

  if (dbUser.passwordHash) {
    if (typeof body.password !== 'string' || body.password.length === 0) {
      return errorResponse('Введіть поточний пароль для підтвердження', 400);
    }
    const valid = await bcrypt.compare(body.password, dbUser.passwordHash);
    if (!valid) {
      // Audit failed deletion attempt — anomalous spike here is a useful
      // signal for "credentials stolen, attacker probing".
      await logAudit({
        userId: user.id,
        actionType: 'user_edit',
        entityType: 'user',
        entityId: user.id,
        details: { action: 'account_delete_attempt', success: false, reason: 'invalid_password' },
        ipAddress: getClientIp(request),
      });
      return errorResponse('Невірний пароль', 401);
    }
  } else if (!dbUser.googleId) {
    return errorResponse(
      'Видалення доступне лише після встановлення пароля або привʼязки соціального входу.',
      400,
    );
  }

  try {
    await deleteAccount(user.id);
    // GDPR Article 17 (right to be forgotten) — successful deletion must
    // be auditable for compliance follow-ups even though the user row is
    // gone. Audit row references userId by integer for forensic timeline.
    await logAudit({
      userId: user.id,
      actionType: 'user_edit',
      entityType: 'user',
      entityId: user.id,
      details: { action: 'account_deleted', email: dbUser.email },
      ipAddress: getClientIp(request),
    });
    const res = successResponse({ message: 'Акаунт видалено' });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    if (error instanceof AccountError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
