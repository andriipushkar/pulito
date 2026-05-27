import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { updateSeoTemplate, deleteSeoTemplate, SeoTemplateError } from '@/services/seo-template';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// PUT accepts partial — every field optional, but if present must match
// the allow-list (mirrors POST schema).
const seoTemplateUpdateSchema = z.object({
  entityType: z.enum(['product', 'category', 'page']).optional(),
  scope: z.enum(['global', 'category', 'regional']).optional(),
  titleTemplate: z.string().min(1).max(200).optional(),
  descriptionTemplate: z.string().min(1).max(500).optional(),
  altTemplate: z.string().max(500).optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
});

export const PUT = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = seoTemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const template = await updateSeoTemplate(numId, {
      ...parsed.data,
      altTemplate: parsed.data.altTemplate ?? undefined,
      categoryId: parsed.data.categoryId ?? undefined,
    });
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
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params, user }) => {
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
});
