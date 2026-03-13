import { NextRequest } from 'next/server';
import { refreshTokens } from '@/services/auth';
import { parseTtlToSeconds } from '@/services/token';
import { AuthError } from '@/services/auth-errors';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getRefreshTokenFromCookies, serializeRefreshTokenCookie } from '@/utils/cookies';
import { getClientIp, getDeviceInfo } from '@/utils/request';
import { env } from '@/config/env';

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const refreshToken = getRefreshTokenFromCookies(cookieHeader);

    if (!refreshToken) {
      return errorResponse('Refresh token не надано', 401);
    }

    const ipAddress = getClientIp(request);
    const deviceInfo = getDeviceInfo(request);

    const { user, tokens } = await refreshTokens(refreshToken, ipAddress, deviceInfo);

    const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const response = successResponse({ user, accessToken: tokens.accessToken });
    response.headers.set('Set-Cookie', serializeRefreshTokenCookie(tokens.refreshToken, refreshTtl));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
