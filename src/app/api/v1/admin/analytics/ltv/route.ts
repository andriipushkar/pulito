import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCustomerLTV } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { parseDays } from '@/utils/analytics-days';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const days = parseDays(request.nextUrl.searchParams.get('days'), 365);
    const data = await getCustomerLTV(days);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/ltv] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
