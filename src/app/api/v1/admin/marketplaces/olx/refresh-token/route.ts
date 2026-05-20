import { withRole } from '@/middleware/auth';
import { refreshOlxToken } from '@/services/marketplaces';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin')(async () => {
  try {
    const result = await refreshOlxToken();
    if (!result.success) return errorResponse(result.error || 'Не вдалося оновити токен', 400);
    return successResponse(result);
  } catch (error) {
    logger.error('[admin/marketplaces/olx/refresh-token] POST failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка';
    return errorResponse(message, 500);
  }
});
