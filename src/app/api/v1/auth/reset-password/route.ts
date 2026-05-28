import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resetPassword } from '@/services/verification';
import { AuthError } from '@/services/auth-errors';
import { checkRateLimit, RATE_LIMITS, RateLimitError } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { passwordSchema } from '@/validators/auth';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const schema = z.object({
  // Token shape is 32 random bytes → 64 hex chars. Pinning the shape stops
  // junk tokens from reaching Redis lookups and gives Zod a clean 422.
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Невалідний токен'),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  try {
    // Rate-limit per IP — token brute-force is computationally infeasible
    // (256-bit entropy) but we still cap abuse to stop log/Redis flood.
    const rl = await checkRateLimit(ip, RATE_LIMITS.sensitive);
    if (!rl.allowed) {
      throw new RateLimitError('Забагато спроб. Спробуйте пізніше.', 429, rl.retryAfter);
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    let userId: number;
    try {
      userId = await resetPassword(parsed.data.token, parsed.data.password);
    } catch (err) {
      if (err instanceof AuthError && err.statusCode === 400) {
        // Failed reset (bad/expired token) — audit the attempt without leaking
        // which token was tried.
        await logAudit({
          userId: null,
          actionType: 'password_reset',
          entityType: 'user',
          details: { action: 'self_reset_failed', reason: 'invalid_token' },
          ipAddress: ip,
        });
      }
      throw err;
    }
    await logAudit({
      userId,
      actionType: 'password_reset',
      entityType: 'user',
      entityId: userId,
      details: { action: 'self_reset_completed' },
      ipAddress: ip,
    });
    return successResponse({ message: 'Пароль успішно змінено. Увійдіть з новим паролем.' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const res = errorResponse(error.message, error.statusCode);
      if (error.retryAfter) res.headers.set('Retry-After', String(error.retryAfter));
      return res;
    }
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
