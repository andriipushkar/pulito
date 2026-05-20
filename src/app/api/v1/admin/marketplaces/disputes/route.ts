import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { aggregateMarketplaceDisputes } from '@/services/marketplace-disputes';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const disputes = await aggregateMarketplaceDisputes();
    return successResponse({ disputes, total: disputes.length });
  } catch (err) {
    logger.error('[admin/marketplaces/disputes] GET failed', { error: err });
    return errorResponse('Помилка завантаження спорів', 500);
  }
});
