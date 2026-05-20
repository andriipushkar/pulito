import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { restoreListing } from '@/services/marketplace-listing-archive';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin', 'manager')(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const cid = Number(id);
    if (Number.isNaN(cid)) return errorResponse('Невалідний ID', 400);
    await restoreListing(cid);
    return successResponse({ restored: true });
  } catch (err) {
    logger.error('[admin/marketplaces/listings/[id]/restore] POST failed', { error: err });
    return errorResponse('Помилка відновлення', 500);
  }
});
