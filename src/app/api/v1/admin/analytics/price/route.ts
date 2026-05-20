import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getPriceAnalytics } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { parseDays } from '@/utils/analytics-days';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    // parseDays floors to 1; getPriceAnalytics requires days >= 2 to split
    // the window into before/after halves, so clamp up.
    const days = Math.max(2, parseDays(request.nextUrl.searchParams.get('days'), 30));
    const data = await getPriceAnalytics(days);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/price] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
