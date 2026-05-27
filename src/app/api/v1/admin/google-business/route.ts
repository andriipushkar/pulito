import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { GoogleBusinessError, getPlaceDetails, isConfigured } from '@/services/google-business';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withRole(
  'admin',
  'manager',
)(async (request, { user }) => {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';

    // ?force=1 bypasses the Redis cache and calls Google Places (paid API).
    // Stuck UI / hijacked session could otherwise drain the API budget.
    // Cached path is free so it stays unlimited.
    if (force) {
      const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
      if (!rl.allowed) {
        return errorResponse(`Забагато примусових оновлень. Зачекайте ${rl.retryAfter}с.`, 429);
      }
    }

    const configured = await isConfigured();
    if (!configured) {
      return successResponse({
        configured: false,
        details: null,
      });
    }

    const details = await getPlaceDetails(force);
    const res = successResponse({ configured: true, details });
    // Short-lived CDN/proxy cache reduces Redis hits when the dashboard
    // widget polls this endpoint.
    res.headers.set('Cache-Control', 'private, max-age=300');
    return res;
  } catch (err) {
    if (err instanceof GoogleBusinessError) {
      return errorResponse(err.message, err.statusCode);
    }
    logger.error('[admin/google-business] GET failed', { error: err });
    return errorResponse('Помилка отримання даних Google Business', 500);
  }
});
