import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getDemandForecast } from '@/services/demand-forecast';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const leadTime = sp.get('leadTimeDays') ? Number(sp.get('leadTimeDays')) : undefined;
    const buffer = sp.get('bufferDays') ? Number(sp.get('bufferDays')) : undefined;
    const limit = sp.get('limit') ? Math.min(Number(sp.get('limit')), 500) : 100;
    const movingOnly = sp.get('movingOnly') === '1';

    const forecast = await getDemandForecast({
      leadTimeDays: leadTime,
      bufferDays: buffer,
      limit,
      movingOnly,
    });

    // 3 heavy aggregates + sort on every GET. Forecast drift over a few
    // minutes is fine — admin tweaks filters, page reloads stay snappy.
    const res = successResponse(forecast);
    res.headers.set('Cache-Control', 'private, max-age=300');
    return res;
  } catch (err) {
    logger.error('[admin/forecasting] GET failed', { error: err });
    return errorResponse('Помилка обчислення прогнозу', 500);
  }
});
