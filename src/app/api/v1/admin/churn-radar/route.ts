import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getChurnRadar } from '@/services/churn';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const days = Number(request.nextUrl.searchParams.get('days')) || 30;
    const limit = Number(request.nextUrl.searchParams.get('limit')) || 10;
    const entries = await getChurnRadar({ minDaysSilent: days, limit });
    return successResponse({ entries, minDaysSilent: days });
  } catch {
    return errorResponse('Не вдалося порахувати churn', 500);
  }
});
