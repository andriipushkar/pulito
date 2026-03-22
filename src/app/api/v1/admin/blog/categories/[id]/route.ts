import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateBlogCategorySchema } from '@/validators/blog';
import { updateCategory, deleteCategory, BlogError } from '@/services/blog';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PATCH = withRole('manager', 'admin')(
  async (request: NextRequest, { params }) => {
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
      return successResponse(category);
    } catch (error) {
      if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      await deleteCategory(numId);
      return successResponse({ message: 'Категорію видалено' });
    } catch (error) {
      if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
