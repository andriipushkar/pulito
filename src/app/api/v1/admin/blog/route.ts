import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { createBlogPostSchema } from '@/validators/blog';
import { createPost, BlogError } from '@/services/blog';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  parseSearchParams,
} from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const { page, limit, search } = parseSearchParams(request.nextUrl.searchParams);
    // ?includeDeleted=true opt-in shows soft-deleted posts (for the future
    // restore UI). Default hides them so the regular admin list matches
    // what's actually visible on the site.
    const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === 'true';

    const where: Record<string, unknown> = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
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

    // Flatten to the shape the admin list expects. Returning the raw Prisma
    // row leaked `category` as an object ({id,name,slug}) — React then tried to
    // render it directly (error #31) — and exposed isPublished/viewsCount under
    // the wrong names, leaving the Status/Views columns blank.
    const rows = posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category?.name ?? null,
      status: p.isPublished ? 'published' : 'draft',
      views: p.viewsCount,
      createdAt: p.createdAt,
      deletedAt: p.deletedAt,
    }));

    return paginatedResponse(rows, total, page, limit);
  } catch (err) {
    logger.error('[admin/blog] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createBlogPostSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const post = await createPost(parsed.data, user.id);
    await logAudit({
      userId: user.id,
      actionType: 'publication_create',
      entityType: 'blog_post',
      entityId: post.id,
      details: { title: post.title, slug: post.slug },
      ipAddress: getClientIp(request),
    });
    // Bust the storefront ISR cache so the new post appears immediately on
    // /blog and /blog/[slug] instead of waiting for the next revalidate tick.
    if (post.isPublished) {
      revalidatePath('/blog');
      revalidatePath(`/blog/${post.slug}`);
      revalidatePath('/sitemap.xml');
    }
    return successResponse(post, 201);
  } catch (error) {
    if (error instanceof BlogError) return errorResponse(error.message, error.statusCode);
    logger.error('[admin/blog] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
