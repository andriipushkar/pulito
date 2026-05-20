import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { aggregateMarketplaceReviews } from '@/services/marketplace-reviews';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const reviews = await aggregateMarketplaceReviews();
    return successResponse({ reviews, total: reviews.length });
  } catch (err) {
    logger.error('[admin/marketplaces/reviews] GET failed', { error: err });
    return errorResponse('Помилка завантаження відгуків', 500);
  }
});
