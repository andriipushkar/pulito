import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { z } from 'zod';
import { updatePage, deletePage, StaticPageError } from '@/services/static-page';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const updateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(200)
    .optional(),
  content: z.string().min(1).max(200_000).optional(),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  titleEn: z.string().max(200).optional(),
  contentEn: z.string().max(200_000).optional(),
  seoTitleEn: z.string().max(160).optional(),
  seoDescriptionEn: z.string().max(320).optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // Hierarchy — one level deep. null = root.
  parentId: z.number().int().positive().nullable().optional(),
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const page = await updatePage(numId, { ...parsed.data, updatedBy: user.id });
    await logAudit({
      userId: user.id,
      actionType: 'page_edit',
      entityType: 'page',
      entityId: numId,
      details: parsed.data,
      ipAddress: getClientIp(request),
    });
    // Bust ISR cache so storefront shows the edit immediately.
    revalidatePath(`/pages/${page.slug}`);
    revalidatePath('/sitemap.xml');
    return successResponse(page);
  } catch (error) {
    if (error instanceof StaticPageError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/pages/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await deletePage(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'page',
      entityId: numId,
      ipAddress: getClientIp(request),
    });
    revalidatePath('/sitemap.xml');
    return successResponse({ message: 'Сторінку видалено' });
  } catch (error) {
    if (error instanceof StaticPageError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/pages/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
