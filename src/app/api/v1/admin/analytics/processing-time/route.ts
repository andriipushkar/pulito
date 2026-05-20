import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getOrderProcessingTime } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { parseDays } from '@/utils/analytics-days';

// Whitelist OrderStatus enum values. Anything else would slip through to the
// service layer and either crash the SQL or return zero rows silently.
const VALID_STATUSES = [
  'new_order', 'processing', 'confirmed', 'paid', 'packed',
  'shipped', 'completed', 'cancelled', 'returned',
];

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams;
    const days = parseDays(params.get('days'), 30);
    const fromStatus = params.get('from') || 'new_order';
    const toStatus = params.get('to') || 'shipped';
    if (!VALID_STATUSES.includes(fromStatus) || !VALID_STATUSES.includes(toStatus)) {
      return errorResponse('Невалідний статус замовлення', 400);
    }
    const data = await getOrderProcessingTime(days, fromStatus, toStatus);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/processing-time] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
