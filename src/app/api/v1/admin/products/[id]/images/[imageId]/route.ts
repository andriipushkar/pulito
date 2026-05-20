import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { deleteProductImage, ImageError } from '@/services/image';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';
import { logger } from '@/lib/logger';

export const DELETE = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { imageId } = await params!;
      const numImageId = Number(imageId);
      if (isNaN(numImageId)) return errorResponse('Невалідний ID', 400);
      await deleteProductImage(numImageId);
      await cacheInvalidate('products:*');
      return successResponse({ message: 'Зображення видалено' });
    } catch (error) {
      if (error instanceof ImageError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/products/[id]/images/[imageId]] DELETE failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
