import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getReviewsForModeration } from '@/services/review';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
    const status = url.searchParams.get('status') || undefined;

    const { reviews, total } = await getReviewsForModeration(page, limit, status);
    return successResponse({ reviews, total, page, limit });
  } catch (err) {
    logger.error('[admin/reviews] GET failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});
