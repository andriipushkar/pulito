import { NextRequest } from 'next/server';
import { refreshTokens } from '@/services/auth';
import { parseTtlToSeconds, hashToken } from '@/services/token';
import { AuthError } from '@/services/auth-errors';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getAllRefreshTokensFromCookies, serializeRefreshTokenCookie } from '@/utils/cookies';
import { getClientIp, getDeviceInfo } from '@/utils/request';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const candidates = getAllRefreshTokensFromCookies(cookieHeader);

    if (candidates.length === 0) {
      return errorResponse('Refresh token не надано', 401);
    }

    // Browsers can send multiple refresh_token cookies (e.g. when an older
    // deploy set Path=/api/v1/auth and the current deploy sets Path=/, both
    // linger until they expire). Pick the freshest non-revoked candidate so a
    // stale cookie from a previous session can't poison the refresh.
    let refreshToken: string | null = null;
    for (const tok of candidates) {
      try {
        const stored = await prisma.refreshToken.findUnique({
          where: { tokenHash: hashToken(tok) },
          select: { revokedAt: true },
        });
        if (stored && !stored.revokedAt) {
          refreshToken = tok;
          break;
        }
      } catch {
        // ignore — try next candidate
      }
    }
    // None of the cookies matched a live row — fall back to the first one so
    // refreshTokens() can produce the user-facing error consistently.
    if (!refreshToken) refreshToken = candidates[candidates.length - 1];

    const ipAddress = getClientIp(request);
    const deviceInfo = getDeviceInfo(request);

    const { user, tokens } = await refreshTokens(refreshToken, ipAddress, deviceInfo);

    const refreshTtl = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const response = successResponse({ user, accessToken: tokens.accessToken });
    response.headers.set(
      'Set-Cookie',
      serializeRefreshTokenCookie(tokens.refreshToken, refreshTtl),
    );
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
