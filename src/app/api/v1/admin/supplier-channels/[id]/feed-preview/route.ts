import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { previewSupplierFeed } from '@/services/suppliers/first-import';
import { SupplierChannelError } from '@/services/supplier-channel';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

/**
 * Preview a supplier feed for the first-import matching screen: returns every
 * feed line classified as linked / suggested / unmatched. Read-only.
 */
export const GET = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params, user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminSupplierSync);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато запитів. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }

    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const preview = await previewSupplierFeed(numId);
    return successResponse(preview);
  } catch (err) {
    if (err instanceof SupplierChannelError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/supplier-channels/[id]/feed-preview] failed', { error: err });
    return errorResponse('Не вдалося завантажити фід', 500);
  }
});
