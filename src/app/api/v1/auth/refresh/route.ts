import { NextRequest } from 'next/server';
import { refreshTokens } from '@/services/auth';
import { parseTtlToSeconds, hashToken } from '@/services/token';
import { AuthError } from '@/services/auth-errors';
import { checkRateLimit, RATE_LIMITS, RateLimitError } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import {
  getAllRefreshTokensFromCookies,
  serializeRefreshTokenCookie,
  serializeClearRefreshTokenCookie,
} from '@/utils/cookies';
import { getClientIp, getDeviceInfo } from '@/utils/request';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const ipAddress = getClientIp(request);

    // Rate-limit per IP — prevents a stuck client (or stolen token) from
    // hammering the rotation endpoint. The reuse-detection inside
    // refreshTokens() still nukes the family when a revoked token appears.
    const rl = await checkRateLimit(ipAddress, RATE_LIMITS.auth);
    if (!rl.allowed) {
      throw new RateLimitError('Забагато спроб оновлення сесії.', 429, rl.retryAfter);
    }

    const cookieHeader = request.headers.get('cookie');
    const candidates = getAllRefreshTokensFromCookies(cookieHeader);

    if (candidates.length === 0) {
      // No refresh cookie at all → an unauthenticated guest, not an error.
      // AuthProvider calls this endpoint on every mount, so a 401 here logged a
      // noisy (but harmless) console error on every public page load. Return a
      // 200 "no session" instead; refreshSession() treats a 200 without an
      // accessToken as "not logged in". Genuinely invalid / expired / reused
      // tokens still fall through to the 401s below.
      const res = successResponse({ user: null, accessToken: null });
      res.headers.set('Cache-Control', 'no-store');
      res.headers.set('Pragma', 'no-cache');
      return res;
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
    if (error instanceof RateLimitError) {
      const res = errorResponse(error.message, error.statusCode);
      if (error.retryAfter) res.headers.set('Retry-After', String(error.retryAfter));
      return res;
    }
    if (error instanceof AuthError) {
      // A 401 here means the refresh cookie exists but its token is
      // invalid / expired / revoked — i.e. the session has simply ended. That
      // is not an error worth a red console entry on every page load for a
      // returning visitor. Clear the dead cookie and return a 200 "no session"
      // so the browser self-heals: next load sends no cookie and stays quiet.
      // Non-401 AuthErrors (e.g. 403) are genuine problems and still surface.
      if (error.statusCode === 401) {
        const res = successResponse({ user: null, accessToken: null });
        res.headers.set('Set-Cookie', serializeClearRefreshTokenCookie());
        res.headers.set('Cache-Control', 'no-store');
        res.headers.set('Pragma', 'no-cache');
        return res;
      }
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
