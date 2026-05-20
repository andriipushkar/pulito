import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createComment, BlogCommentError } from '@/services/blog-comments';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const submitSchema = z.object({
  postId: z.number().int().positive(),
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email().max(255).optional().nullable(),
  content: z.string().min(2).max(2000),
  parentId: z.number().int().positive().optional().nullable(),
});

// Naive in-memory rate limit per IP. Production should use Redis, but this
// catches the obvious spam-bot case (1 IP firing 50 comments in a minute).
const RATE_BUCKET = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (RATE_BUCKET.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  RATE_BUCKET.set(ip, hits);
  return hits.length > RATE_MAX;
}

// POST — submit a new comment from the public storefront. Defaults to
// status=pending so admins must approve before it shows. Public route, no
// auth required.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return errorResponse('Забагато коментарів за хвилину — спробуйте пізніше', 429);
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
    if (!postIdRaw || isNaN(postId)) return errorResponse('Очікувався ?postId=', 400);

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
