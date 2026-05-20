import { withRole } from '@/middleware/auth';
import { getDashboardStats } from '@/services/dashboard';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const stats = await getDashboardStats();
    return successResponse(stats);
  } catch (err) {
    logger.error('[admin/dashboard/stats] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
