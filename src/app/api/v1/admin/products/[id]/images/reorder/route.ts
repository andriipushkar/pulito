import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { reorderProductImages, ImageError } from '@/services/image';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';
import { logger } from '@/lib/logger';

export const PATCH = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);

    const body = (await request.json()) as { imageIds?: unknown };
    const imageIds = Array.isArray(body.imageIds) ? body.imageIds : null;
    if (!imageIds || !imageIds.every((v) => Number.isInteger(v))) {
      return errorResponse('Очікується масив imageIds', 400);
    }

    await reorderProductImages(productId, imageIds as number[]);
    await cacheInvalidate('products:*');
    return successResponse({ ok: true });
  } catch (error) {
    if (error instanceof ImageError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/products/[id]/images/reorder] PATCH failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
