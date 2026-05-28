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

    // Before/after diff so publish/unpublish flips (and other edits) are
    // traceable, not just "these fields changed". Large body fields are noted
    // as changed rather than copied into the audit row.
    const LARGE_BLOG_FIELDS = new Set(['content', 'contentEn', 'excerpt', 'excerptEn']);
    const prev = (await prisma.blogPost.findUnique({ where: { id: numId } })) as Record<
      string,
      unknown
    > | null;
    const changedFields = Object.keys(parsed.data);
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    for (const k of changedFields) {
      if (LARGE_BLOG_FIELDS.has(k)) {
        before[k] = '[змінено]';
        after[k] = '[змінено]';
        continue;
      }
      before[k] = prev ? String(prev[k] ?? '') : null;
      after[k] = String((parsed.data as Record<string, unknown>)[k] ?? '');
    }

    const post = await updatePost(numId, parsed.data);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'blog_post',
      entityId: numId,
      details: { fields: changedFields, before, after },
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
