import { withRole } from '@/middleware/auth';
import { getCustomerSegmentation } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const data = await getCustomerSegmentation();
    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/segments] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
