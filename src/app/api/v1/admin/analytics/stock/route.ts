import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getStockAnalytics } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { parseDays } from '@/utils/analytics-days';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const days = parseDays(request.nextUrl.searchParams.get('days'), 30);
    const data = await getStockAnalytics(days);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/stock] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
