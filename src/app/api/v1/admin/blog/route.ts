import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createBlogPostSchema } from '@/validators/blog';
import { createPost, BlogError } from '@/services/blog';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from '@/utils/api-response';

export const GET = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const { page, limit, search } = parseSearchParams(request.nextUrl.searchParams);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return paginatedResponse(posts, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('manager', 'admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const post = await createPost(parsed.data, user.id);
    return successResponse(post, 201);
  } catch (error) {
    if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
