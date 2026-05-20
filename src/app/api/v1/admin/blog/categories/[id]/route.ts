import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateBlogCategorySchema } from '@/validators/blog';
import { updateCategory, deleteCategory, BlogError } from '@/services/blog';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const PATCH = withRole('manager', 'admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const parsed = updateBlogCategorySchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const category = await updateCategory(numId, parsed.data);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'blog_category',
        entityId: numId,
        details: { fields: Object.keys(parsed.data) },
        ipAddress: getClientIp(request),
      });
      return successResponse(category);
    } catch (error) {
      if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/blog/categories/[id]] PATCH failed', { error });
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
        entityType: 'blog_category',
        entityId: numId,
        ipAddress: getClientIp(request),
      });
      return successResponse({ message: 'Категорію видалено' });
    } catch (error) {
      if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
      logger.error('[admin/blog/categories/[id]] DELETE failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
