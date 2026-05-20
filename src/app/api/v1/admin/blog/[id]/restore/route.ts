import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { restorePost, BlogError } from '@/services/blog';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

// POST — restore a soft-deleted blog post (clears `deletedAt`).
// Stays unpublished until the admin explicitly publishes it again — restoring
// must not re-expose content on the site without a deliberate second step.
export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    await restorePost(numId);

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'blog_post',
      entityId: numId,
      details: { action: 'restore' },
      ipAddress: getClientIp(request),
    });

    return successResponse({ restored: true });
  } catch (err) {
    if (err instanceof BlogError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/blog/[id]/restore] POST failed', { error: err });
    return errorResponse('Не вдалося відновити', 500);
  }
});
