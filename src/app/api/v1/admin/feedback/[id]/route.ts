import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateFeedbackStatusSchema } from '@/validators/feedback';
import { updateFeedbackStatus, FeedbackError } from '@/services/feedback';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateFeedbackStatusSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const feedback = await updateFeedbackStatus(numId, parsed.data.status, user.id);

    // `rejected` is dispute-sensitive — manager mass-rejecting complaints
    // must leave a trail for ombud / law-enforcement follow-ups.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'feedback',
      entityId: numId,
      details: { status: parsed.data.status },
      ipAddress: getClientIp(request),
    });

    return successResponse(feedback);
  } catch (error) {
    if (error instanceof FeedbackError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/feedback/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
