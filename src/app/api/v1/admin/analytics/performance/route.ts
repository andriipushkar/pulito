import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getAggregatedMetrics } from '@/services/performance';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams;
    const days = Math.min(90, Math.max(1, Number(params.get('days')) || 30));

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const route = params.get('route') || undefined;

    const metrics = await getAggregatedMetrics(
      dateFrom.toISOString().slice(0, 10),
      dateTo.toISOString().slice(0, 10),
      route
    );

    return successResponse(metrics);
  } catch (err) {
    logger.error('[admin/analytics/performance] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
