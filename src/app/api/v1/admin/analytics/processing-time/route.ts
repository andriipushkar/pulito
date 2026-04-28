import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getOrderProcessingTime } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams;
    const days = Number(params.get('days')) || 30;
    const fromStatus = params.get('from') || 'new_order';
    const toStatus = params.get('to') || 'shipped';
    const data = await getOrderProcessingTime(days, fromStatus, toStatus);
    return successResponse(data);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
