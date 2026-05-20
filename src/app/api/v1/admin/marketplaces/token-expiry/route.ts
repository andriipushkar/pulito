import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getAllTokenExpiryInfo } from '@/services/marketplace-token-expiry';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const info = await getAllTokenExpiryInfo();
    return successResponse(info);
  } catch (err) {
    logger.error('[admin/marketplaces/token-expiry] GET failed', { error: err });
    return errorResponse('Помилка завантаження токенів', 500);
  }
});
