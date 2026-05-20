import { withRole } from '@/middleware/auth';
import { generateUserManual } from '@/services/user-manual-pdf';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin', 'manager')(async () => {
  try {
    const url = await generateUserManual();
    return successResponse({ url, message: 'Інструкцію користувача згенеровано' });
  } catch (err) {
    logger.error('[admin/docs/user-manual] POST failed', { error: err });
    return errorResponse('Помилка генерації інструкції', 500);
  }
});
