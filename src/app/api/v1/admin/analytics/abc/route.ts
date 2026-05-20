import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getABCAnalysis } from '@/services/analytics';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get('days')) || 30));
    const data = await getABCAnalysis(days);
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/abc] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
