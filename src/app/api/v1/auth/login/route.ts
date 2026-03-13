import { NextRequest } from 'next/server';
import { loginSchema } from '@/validators/auth';
import { loginUser } from '@/services/auth';
import { parseTtlToSeconds } from '@/services/token';
import { AuthError } from '@/services/auth-errors';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts, RateLimitError } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { serializeRefreshTokenCookie } from '@/utils/cookies';
import { getClientIp, getDeviceInfo } from '@/utils/request';
import { env } from '@/config/env';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    const ipAddress = getClientIp(request);
    const deviceInfo = getDeviceInfo(request);

    // Rate limiting: check before attempting login
    await checkLoginRateLimit(ipAddress, parsed.data.email);

    let result;
    try {
      result = await loginUser({
        ...parsed.data,
        ipAddress,
        deviceInfo,
      });
    } catch (error) {
      if (error instanceof AuthError && error.statusCode === 401) {
        // Record failed attempt
        await recordFailedLogin(ipAddress, parsed.data.email);
      }
      throw error;
    }

    // Successful login — clear rate limit
    await clearLoginAttempts(ipAddress, parsed.data.email);

    // If 2FA is required, return temp token without setting cookies
    if (result.requiresTwoFactor) {
      return successResponse({ requiresTwoFactor: true, tempToken: result.tempToken });
    }

    const { user, tokens } = result;
    const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const response = successResponse({ user, accessToken: tokens.accessToken });
    response.headers.set('Set-Cookie', serializeRefreshTokenCookie(tokens.refreshToken, refreshTtl));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      const res = errorResponse(error.message, error.statusCode);
      if (error.retryAfter) {
        res.headers.set('Retry-After', String(error.retryAfter));
      }
      return res;
    }
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
