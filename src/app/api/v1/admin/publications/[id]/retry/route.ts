import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { retryChannel, PublicationError } from '@/services/publication';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const VALID_CHANNELS = [
  'telegram',
  'viber',
  'facebook',
  'instagram',
  'tiktok',
  'site',
  'olx',
  'rozetka',
  'prom',
  'epicentrk',
];

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const { channel } = await request.json();
    if (!channel || typeof channel !== 'string' || !VALID_CHANNELS.includes(channel)) {
      return errorResponse('Невалідний канал', 400);
    }

    const pub = await retryChannel(numId, channel);

    // Retry triggers external API call — audit so we can trace duplicate-post
    // incidents back to who clicked retry.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'publication',
      entityId: numId,
      details: { action: 'retry_channel', channel },
      ipAddress: getClientIp(request),
    });

    return successResponse(pub);
  } catch (error) {
    if (error instanceof PublicationError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/publications/[id]/retry] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
