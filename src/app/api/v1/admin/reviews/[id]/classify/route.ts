import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { classifyReviewById } from '@/services/review-ai';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const reviewId = Number(id);
    if (isNaN(reviewId)) return errorResponse('Невірний ID', 400);
    const review = await classifyReviewById(reviewId);
    if (!review) {
      return errorResponse(
        'Не вдалося класифікувати. Перевірте, що ANTHROPIC_API_KEY налаштований.',
        500,
      );
    }
    return successResponse(review);
  } catch (err) {
    logger.error('[admin/reviews/[id]/classify] POST failed', { error: err });
    return errorResponse('Помилка сервера', 500);
  }
});
