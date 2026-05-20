import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateCategorySchema } from '@/validators/category';
import { getCategoryById, updateCategory, deleteCategory, CategoryError } from '@/services/category';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const GET = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const category = await getCategoryById(numId);

      if (!category) {
        return errorResponse('Категорію не знайдено', 404);
      }

      return successResponse(category);
    } catch (err) {
      logger.error('[admin/categories/[id]] GET failed', { error: err });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const PUT = withRole('manager', 'admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();
      const parsed = updateCategorySchema.safeParse(body);

      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
        return errorResponse(firstError, 422);
      }

      const category = await updateCategory(numId, parsed.data);
      return successResponse(category);
    } catch (error) {
      if (error instanceof CategoryError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/categories/[id]] PUT failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('manager', 'admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      await deleteCategory(numId);
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'category',
        entityId: numId,
        ipAddress: getClientIp(request),
      });
      return successResponse({ message: 'Категорію видалено' });
    } catch (error) {
      if (error instanceof CategoryError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/categories/[id]] DELETE failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
