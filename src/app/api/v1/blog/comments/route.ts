import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createComment, BlogCommentError } from '@/services/blog-comments';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const submitSchema = z.object({
  postId: z.number().int().positive(),
  authorName: z.string().trim().min(1).max(100),
  authorEmail: z.string().trim().toLowerCase().email().max(255).optional().nullable(),
  content: z.string().trim().min(2).max(2000),
  parentId: z.number().int().positive().optional().nullable(),
});

// POST — submit a new comment from the public storefront. Defaults to
// status=pending so admins must approve before it shows. Public route, no
// auth required.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // Redis-backed rate-limit shared across PM2 workers — the previous
    // in-memory Map died on every deploy and didn't dedupe between forks.
    const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.reviews);
    if (!rl.allowed) {
      return errorResponse('Забагато коментарів — спробуйте пізніше', 429);
    }

    const body = await request.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const comment = await createComment({
      postId: parsed.data.postId,
      authorName: parsed.data.authorName,
      authorEmail: parsed.data.authorEmail ?? null,
      content: parsed.data.content,
      parentId: parsed.data.parentId ?? null,
      ipAddress: ip,
    });

    return successResponse({ id: comment.id, status: comment.status }, 201);
  } catch (err) {
    if (err instanceof BlogCommentError) return errorResponse(err.message, err.statusCode);
    logger.error('[blog/comments] POST failed', { error: err });
    return errorResponse('Не вдалося надіслати коментар', 500);
  }
}

// GET — list approved comments for a post (newest first, threaded).
export async function GET(request: NextRequest) {
  try {
    const postIdRaw = request.nextUrl.searchParams.get('postId');
    const postId = Number(postIdRaw);
    // `isNaN(-5) === false` — guard with positive-integer check.
    if (!postIdRaw || !Number.isFinite(postId) || postId <= 0 || !Number.isInteger(postId)) {
      return errorResponse('Очікувався ?postId=', 400);
    }

    const comments = await prisma.blogComment.findMany({
      where: { postId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        authorName: true,
        content: true,
        createdAt: true,
        parentId: true,
      },
    });
    return successResponse(comments);
  } catch (err) {
    logger.error('[blog/comments] GET failed', { error: err });
    return errorResponse('Помилка завантаження коментарів', 500);
  }
}
