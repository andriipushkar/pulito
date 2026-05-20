import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getSeoTemplates, createSeoTemplate, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(
  async () => {
    try {
      const templates = await getSeoTemplates();
      return successResponse(templates);
    } catch (error) {
      if (error instanceof SeoTemplateError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/seo-templates] GET failed', { error });
      return errorResponse('Помилка завантаження шаблонів', 500);
    }
  }
);

export const POST = withRole('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();
      const template = await createSeoTemplate(body);
      await logAudit({
        userId: user.id,
        actionType: 'data_create',
        entityType: 'seo_template',
        entityId: template.id,
      });
      return successResponse(template, 201);
    } catch (error) {
      if (error instanceof SeoTemplateError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/seo-templates] POST failed', { error });
      return errorResponse('Помилка створення шаблону', 500);
    }
  }
);
