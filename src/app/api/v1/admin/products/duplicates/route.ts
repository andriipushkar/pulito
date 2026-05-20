import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { findDuplicateProducts } from '@/services/duplicate-detector';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const thresholdParam = request.nextUrl.searchParams.get('threshold');
    const threshold = thresholdParam ? Number(thresholdParam) : 0.65;
    const pairs = await findDuplicateProducts(
      Number.isFinite(threshold) ? Math.min(Math.max(threshold, 0.4), 0.95) : 0.65,
    );
    return successResponse(pairs);
  } catch (err) {
    logger.error('[admin/products/duplicates] GET failed', { error: err });
    return errorResponse('Помилка пошуку дублів', 500);
  }
});
