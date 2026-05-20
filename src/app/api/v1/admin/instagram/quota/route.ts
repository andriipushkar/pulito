import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getInstagramQuota } from '@/services/instagram-quota';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest) => {
  try {
    const status = await getInstagramQuota();
    return successResponse(status);
  } catch (err) {
    logger.error('[admin/instagram/quota] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
