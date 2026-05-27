import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { sendFeedbackReply, FeedbackError } from '@/services/feedback';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const schema = z.object({
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(20_000),
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const force = request.nextUrl.searchParams.get('force') === '1';
    const updated = await sendFeedbackReply(
      numId,
      parsed.data.subject,
      parsed.data.bodyHtml,
      user.id,
      { force },
    );

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'feedback',
      entityId: numId,
      details: { action: 'reply', subject: parsed.data.subject },
      ipAddress: getClientIp(request),
    });

    return successResponse(updated);
  } catch (err) {
    if (err instanceof FeedbackError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/feedback/[id]/reply] POST failed', { error: err });
    return errorResponse('Не вдалося надіслати відповідь', 500);
  }
});
