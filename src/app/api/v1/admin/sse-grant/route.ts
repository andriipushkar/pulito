import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { signSseGrantToken, SSE_GRANT_TTL_SECONDS } from '@/services/token';
import { serializeSseGrantCookie } from '@/utils/cookies';
import { logger } from '@/lib/logger';

// Issue a short-lived (5 min) HttpOnly cookie used by EventSource on the
// admin notifications stream. The endpoint sits behind withRole2fa('admin')
// so a stolen access token + manager-role session cannot create the cookie
// — closes the "token-in-query bypasses 2FA gate" finding from the audit.
export const POST = withRole2fa('admin')(async (_request, { user }) => {
  try {
    const grant = signSseGrantToken({
      userId: user.id,
      role: user.role,
      scope: 'admin_notifications',
    });
    const res = successResponse({ ttlSeconds: SSE_GRANT_TTL_SECONDS });
    res.headers.set('Set-Cookie', serializeSseGrantCookie(grant, SSE_GRANT_TTL_SECONDS));
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    logger.error('[admin/sse-grant] POST failed', { error: err });
    return errorResponse('Не вдалося видати SSE-токен', 500);
  }
});
