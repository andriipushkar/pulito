import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateBlogPostSchema } from '@/validators/blog';
import { updatePost, deletePost, BlogError } from '@/services/blog';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const post = await prisma.blogPost.findUnique({
        where: { id: numId },
        include: { category: true },
      });

      if (!post) return errorResponse('Статтю не знайдено', 404);

      return successResponse(post);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const PATCH = withRole('manager', 'admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const parsed = updateBlogPostSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
      }

      const post = await updatePost(numId, parsed.data);
      return successResponse(post);
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

      await deletePost(numId);
      return successResponse({ message: 'Статтю видалено' });
    } catch (error) {
      if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
