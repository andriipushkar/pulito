import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { updateBlogPostSchema } from '@/validators/blog';
import { updatePost, deletePost, BlogError } from '@/services/blog';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params }) => {
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
  } catch (err) {
    logger.error('[admin/blog/[id]] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PATCH = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
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
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'blog_post',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
    });
    // Bust ISR cache for the blog listing + this post's detail page.
    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
    return successResponse(post);
  } catch (error) {
    if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/blog/[id]] PATCH failed', { error });
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

    await deletePost(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'blog_post',
      entityId: numId,
      ipAddress: getClientIp(request),
    });
    // Bust caches so the deleted post stops appearing in /blog listing.
    revalidatePath('/blog');
    revalidatePath('/sitemap.xml');
    return successResponse({ message: 'Статтю видалено' });
  } catch (error) {
    if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/blog/[id]] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
