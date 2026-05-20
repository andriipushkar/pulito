import { NextRequest } from 'next/server';
import { logoutUser } from '@/services/auth';
import { verifyAccessToken } from '@/services/token';
import { errorResponse, successResponse } from '@/utils/api-response';
import { getRefreshTokenFromCookies, serializeClearRefreshTokenCookie } from '@/utils/cookies';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!accessToken) {
      return errorResponse('Токен не надано', 401);
    }

    // Resolve user id BEFORE logoutUser blacklists the token, so the audit row
    // attributes the logout to the correct account even if the token has just
    // expired in transit.
    let userId: number | null = null;
    try {
      userId = verifyAccessToken(accessToken).sub;
    } catch {
      // Invalid/expired token — still allow logout to clear cookies, just skip audit.
    }

    const cookieHeader = request.headers.get('cookie');
    const refreshToken = getRefreshTokenFromCookies(cookieHeader) || undefined;

    await logoutUser(accessToken, refreshToken);

    if (userId !== null) {
      await logAudit({
        userId,
        actionType: 'logout',
        entityType: 'user',
        entityId: userId,
        ipAddress: getClientIp(request),
      });
    }

    const response = successResponse({ message: 'Вихід виконано' });
    response.headers.set('Set-Cookie', serializeClearRefreshTokenCookie());

    return response;
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
