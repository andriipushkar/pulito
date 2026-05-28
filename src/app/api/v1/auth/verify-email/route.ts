import { NextRequest } from 'next/server';
import { verifyEmail, sendEmailVerification } from '@/services/verification';
import { withAuth } from '@/middleware/auth';
import { AuthError } from '@/services/auth-errors';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { successResponse, errorResponse } from '@/utils/api-response';

// POST /api/v1/auth/verify-email — verify with token
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  try {
    // Token brute-force is computationally infeasible (256-bit) but rate-limit
    // caps log/Redis flood and forces an attacker to space out attempts.
    const rl = await checkRateLimit(ip, RATE_LIMITS.sensitive);
    if (!rl.allowed) return errorResponse('Забагато спроб', 429);

    const { token } = await request.json();
    // Verification tokens are `randomBytes(32).toString('hex')` → exactly 64
    // hex chars. Pin the shape so junk submissions get 400 before Redis.
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return errorResponse('Токен підтвердження не надано', 400);
    }

    try {
      await verifyEmail(token);
    } catch (err) {
      if (err instanceof AuthError) {
        await logAudit({
          userId: null,
          actionType: 'user_edit',
          entityType: 'user',
          details: { action: 'email_verify_failed', reason: 'invalid_token' },
          ipAddress: ip,
        });
      }
      throw err;
    }
    return successResponse({ message: 'Email успішно підтверджено' });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}

// PUT /api/v1/auth/verify-email — resend verification (auth required)
export const PUT = withAuth(async (_request, { user }) => {
  try {
    // Per-user resend cap stops a logged-in user (or stolen session) from
    // mail-bombing their own inbox and burning our SMTP reputation.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
    if (!rl.allowed) {
      return errorResponse('Забагато спроб відправлення листа. Спробуйте пізніше.', 429);
    }

    await sendEmailVerification(user.id);
    return successResponse({ message: 'Лист підтвердження надіслано повторно' });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
