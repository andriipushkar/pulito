import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getABCAnalysis } from '@/services/analytics';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`u${user.id}`, RATE_LIMITS.admin);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter}с`, 429);
    }
    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get('days')) || 30));
    const data = await getABCAnalysis(days);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/abc] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
