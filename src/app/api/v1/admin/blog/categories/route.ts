import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createBlogCategorySchema } from '@/validators/blog';
import { getCategories, createCategory, BlogError } from '@/services/blog';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('manager', 'admin')(async () => {
  try {
    const categories = await getCategories();
    return successResponse(categories);
  } catch (err) {
    logger.error('[admin/blog/categories] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('manager', 'admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createBlogCategorySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const category = await createCategory(parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'blog_category',
      entityId: category.id,
    });
    return successResponse(category, 201);
  } catch (error) {
    if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/blog/categories] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
