import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { z } from 'zod';
import { getAllPages, createPage, StaticPageError } from '@/services/static-page';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const createSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(200)
    .optional(),
  // 200 KB cap — well above any real static page; stops a single POST from
  // bloating cached HTML for every visitor.
  content: z.string().min(1).max(200_000),
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  titleEn: z.string().max(200).optional(),
  contentEn: z.string().max(200_000).optional(),
  seoTitleEn: z.string().max(160).optional(),
  seoDescriptionEn: z.string().max(320).optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const GET = withRole(
  'manager',
  'admin',
)(async () => {
  try {
    const pages = await getAllPages();
    return successResponse(pages);
  } catch (err) {
    logger.error('[admin/pages] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const page = await createPage({ ...parsed.data, updatedBy: user.id });
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'static_page',
      entityId: page.id,
      details: { slug: page.slug, isPublished: page.isPublished },
    });
    return successResponse(page, 201);
  } catch (error) {
    if (error instanceof StaticPageError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/pages] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
