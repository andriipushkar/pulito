import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyTwoFactorLogin } from '@/services/auth';
import { parseTtlToSeconds } from '@/services/token';
import { AuthError } from '@/services/auth-errors';
import { successResponse, errorResponse } from '@/utils/api-response';
import { serializeRefreshTokenCookie } from '@/utils/cookies';
import { getClientIp, getDeviceInfo } from '@/utils/request';
import { env } from '@/config/env';
import { logAudit } from '@/services/audit';

const verifyLoginSchema = z.object({
  tempToken: z.string().min(1, "Токен обов'язковий"),
  code: z.string().min(1, "Код обов'язковий"),
});

/**
 * POST /api/v1/auth/2fa/verify-login
 * Completes the login flow for users with 2FA enabled.
 * Requires the temp token from /auth/login and a valid TOTP code.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifyLoginSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    // Rate limit by temp token suffix
    const { redis } = await import('@/lib/redis');
    const rateLimitKey = `2fa_verify:${parsed.data.tempToken.slice(-16)}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 900);
    if (attempts > 5) {
      return errorResponse('Забагато спроб. Спробуйте через 15 хвилин.', 429);
    }

    const ipAddress = getClientIp(request);
    const deviceInfo = getDeviceInfo(request);

    let result: Awaited<ReturnType<typeof verifyTwoFactorLogin>>;
    try {
      result = await verifyTwoFactorLogin(
        parsed.data.tempToken,
        parsed.data.code,
        ipAddress,
        deviceInfo,
      );
    } catch (error) {
      console.warn('[2fa/verify-login] failed', {
        codeLen: parsed.data.code.length,
        ip: ipAddress,
        tempTokenTail: parsed.data.tempToken.slice(-12),
        err: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof AuthError && error.statusCode === 401) {
        await logAudit({
          userId: null,
          actionType: 'login',
          entityType: 'user',
          details: { success: false, method: '2fa', reason: 'invalid_code' },
          ipAddress,
        });
      }
      throw error;
    }

    const { user, tokens } = result;
    await logAudit({
      userId: user.id,
      actionType: 'login',
      entityType: 'user',
      entityId: user.id,
      details: { method: '2fa' },
      ipAddress,
    });

    const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const response = successResponse({ user, accessToken: tokens.accessToken });
    response.headers.set(
      'Set-Cookie',
      serializeRefreshTokenCookie(tokens.refreshToken, refreshTtl),
    );

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
