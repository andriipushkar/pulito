import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { createCategorySchema } from '@/validators/category';
import { createCategory, getCategories, CategoryError } from '@/services/category';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const GET = withRole(
  'manager',
  'admin',
)(async () => {
  try {
    const categories = await getCategories({ includeHidden: true });
    return successResponse(categories);
  } catch (err) {
    logger.error('[admin/categories] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
      return errorResponse(firstError, 422);
    }

    const category = await createCategory(parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'category',
      entityId: category.id,
      details: { name: category.name, slug: category.slug },
      ipAddress: getClientIp(request),
    });
    try {
      revalidatePath('/catalog');
      revalidatePath('/');
      revalidatePath('/sitemap.xml');
    } catch {
      /* best-effort */
    }
    return successResponse(category, 201);
  } catch (error) {
    if (error instanceof CategoryError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/categories] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
