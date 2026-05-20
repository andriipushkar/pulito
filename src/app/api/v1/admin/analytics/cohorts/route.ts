import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCohortAnalysis } from '@/services/analytics';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const months = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get('months')) || 6));
    const data = await getCohortAnalysis(months);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/cohorts] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
