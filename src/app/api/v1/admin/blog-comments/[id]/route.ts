import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import {
  approveComment,
  rejectComment,
  deleteComment,
  BlogCommentError,
} from '@/services/blog-comments';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'spam']),
});

export const PUT = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const result =
      parsed.data.action === 'approve'
        ? await approveComment(numId, user.id)
        : await rejectComment(numId, user.id, parsed.data.action === 'spam' ? 'spam' : 'reject');

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'blog_comment',
      entityId: numId,
      details: { action: parsed.data.action },
    });

    return successResponse(result);
  } catch (err) {
    if (err instanceof BlogCommentError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/blog-comments/[id]] PUT failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await deleteComment(numId);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'blog_comment',
      entityId: numId,
    });
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof BlogCommentError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/blog-comments/[id]] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити', 500);
  }
});
