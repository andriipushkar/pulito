import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { getSeoTemplates, createSeoTemplate, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// Allow-listed entity types and scopes — anything else lets admin create
// templates that are never read by the generator (silent breakage).
const seoTemplateBodySchema = z.object({
  entityType: z.enum(['product', 'category', 'page']),
  scope: z.enum(['global', 'category', 'regional']).optional(),
  titleTemplate: z.string().min(1).max(200),
  descriptionTemplate: z.string().min(1).max(500),
  altTemplate: z.string().max(500).optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
});

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
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
});

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = seoTemplateBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const template = await createSeoTemplate({
      entityType: parsed.data.entityType,
      scope: parsed.data.scope ?? 'global',
      titleTemplate: parsed.data.titleTemplate,
      descriptionTemplate: parsed.data.descriptionTemplate,
      altTemplate: parsed.data.altTemplate ?? undefined,
      categoryId: parsed.data.categoryId ?? undefined,
    });
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
});
