import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { publishNow, PublicationError } from '@/services/publication';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Idempotency guard: only flip the status if it is currently NOT already
    // scheduled/publishing. Two rapid clicks (or duplicate retries) used to
    // both pass through and call publishNow twice, posting the same content
    // to Telegram/Instagram twice. updateMany returns count=0 when the
    // claim fails, and we refuse to enqueue.
    const claimed = await prisma.publication.updateMany({
      where: { id: numId, status: { in: ['draft', 'failed', 'partial'] } },
      data: { status: 'scheduled' },
    });
    if (claimed.count === 0) {
      return errorResponse('Публікація вже опрацьовується або завершена', 409);
    }

    // Start publishing in the background (don't await)
    publishNow(numId).catch((err) => {
      logger.error('[admin/publications/[id]/publish] background failure', {
        publicationId: numId,
        error: err,
      });
    });

    // Manual publish is auditable — admin trigger fires external API posts
    // and locks the publication for further edits.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'publication',
      entityId: numId,
      details: { action: 'publish_now' },
      ipAddress: getClientIp(request),
    });

    return successResponse({ id: numId, status: 'publishing' });
  } catch (error) {
    if (error instanceof PublicationError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/publications/[id]/publish] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
