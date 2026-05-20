import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getPlans } from '@/services/billing';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin')(async () => {
  try {
    const plans = await getPlans();
    return successResponse(plans);
  } catch (err) {
    logger.error('[admin/plans] request failed', { error: err });
    return errorResponse('Помилка завантаження планів', 500);
  }
});
