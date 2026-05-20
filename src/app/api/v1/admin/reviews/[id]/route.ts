import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { moderateReview, replyToReview, deleteReview } from '@/services/review';
import { moderateReviewSchema, replyReviewSchema } from '@/validators/review';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const PATCH = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const reviewId = Number(id);
      if (isNaN(reviewId)) return errorResponse('Невірний ID', 400);

      const body = await request.json();

      // Handle reply
      if (body.adminReply !== undefined) {
        const parsed = replyReviewSchema.safeParse(body);
        if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
        const review = await replyToReview(reviewId, parsed.data.adminReply);
        return successResponse(review);
      }

      // Handle moderation
      const parsed = moderateReviewSchema.safeParse(body);
      if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      const review = await moderateReview(reviewId, parsed.data.status);
      return successResponse(review);
    } catch (err) {
      logger.error('[admin/reviews/[id]] PATCH failed', { error: err });
      return errorResponse('Помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const reviewId = Number(id);
      if (isNaN(reviewId)) return errorResponse('Невірний ID', 400);
      await deleteReview(reviewId);
      return successResponse({ deleted: true });
    } catch (err) {
      logger.error('[admin/reviews/[id]] DELETE failed', { error: err });
      return errorResponse('Помилка сервера', 500);
    }
  }
);
