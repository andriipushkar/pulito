import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createBlogCategorySchema } from '@/validators/blog';
import { getCategories, createCategory, BlogError } from '@/services/blog';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('manager', 'admin')(async () => {
  try {
    const categories = await getCategories();
    return successResponse(categories);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createBlogCategorySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const category = await createCategory(parsed.data);
    return successResponse(category, 201);
  } catch (error) {
    if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
