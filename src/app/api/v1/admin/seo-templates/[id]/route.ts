import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateSeoTemplate, deleteSeoTemplate, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const PUT = withRole('admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();
      const template = await updateSeoTemplate(numId, body);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'seo_template',
        entityId: numId,
      });
      return successResponse(template);
    } catch (error) {
      if (error instanceof SeoTemplateError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/seo-templates/[id]] PUT failed', { error });
      return errorResponse('Помилка оновлення шаблону', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      await deleteSeoTemplate(numId);
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'seo_template',
        entityId: numId,
      });
      return successResponse({ deleted: true });
    } catch (error) {
      if (error instanceof SeoTemplateError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/seo-templates/[id]] DELETE failed', { error });
      return errorResponse('Помилка видалення шаблону', 500);
    }
  }
);
