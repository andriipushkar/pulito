import { withRole } from '@/middleware/auth';
import { processDigestEmails } from '@/services/jobs/digest';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin')(async () => {
  try {
    const result = await processDigestEmails();
    return successResponse(result);
  } catch (err) {
    logger.error('[admin/jobs/digest] POST failed', { error: err });
    return errorResponse('Помилка запуску дайджесту', 500);
  }
});
