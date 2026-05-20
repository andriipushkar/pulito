import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getImageQualityReport } from '@/services/image-quality';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 500, 1000);
    const report = await getImageQualityReport(limit);
    return successResponse(report);
  } catch (err) {
    logger.error('[admin/products/image-quality] GET failed', { error: err });
    return errorResponse('Помилка перевірки якості зображень', 500);
  }
});
