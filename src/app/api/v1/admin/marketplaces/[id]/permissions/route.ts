import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { isMarketplacePlatform } from '@/services/marketplace-health';
import { testPermissions } from '@/services/marketplace-permission-test';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isMarketplacePlatform(id)) return errorResponse('Невідома платформа', 400);
    const results = await testPermissions(id);
    return successResponse(results);
  } catch (err) {
    logger.error('[admin/marketplaces/[id]/permissions] GET failed', { error: err });
    return errorResponse('Помилка перевірки прав', 500);
  }
});
