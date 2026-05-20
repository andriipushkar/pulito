import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { listComments } from '@/services/blog-comments';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const postIdRaw = request.nextUrl.searchParams.get('postId');
    const postId = postIdRaw ? Number(postIdRaw) : undefined;

    const comments = await listComments({ status, postId });
    return successResponse(comments);
  } catch (err) {
    logger.error('[admin/blog-comments] GET failed', { error: err });
    return errorResponse('Помилка завантаження', 500);
  }
});
