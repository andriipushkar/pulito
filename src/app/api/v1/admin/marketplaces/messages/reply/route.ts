import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { replyToMarketplaceMessage } from '@/services/marketplaces';
import { isMarketplacePlatform } from '@/services/marketplace-health';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      channel?: string;
      threadId?: string;
      text?: string;
    };

    if (!body.channel || !isMarketplacePlatform(body.channel)) {
      return errorResponse('Невідомий маркетплейс', 400);
    }
    if (!body.threadId || !body.text) {
      return errorResponse('threadId та text обовʼязкові', 400);
    }

    const result = await replyToMarketplaceMessage(body.channel, body.threadId, body.text);
    if (!result.success) return errorResponse(result.error || 'Помилка відправки', 400);

    // Persist the response timestamp so SLA can be measured.
    try {
      await prisma.marketplaceMessage.updateMany({
        where: {
          platform: body.channel,
          externalThreadId: body.threadId,
          firstRespondedAt: null,
        },
        data: { firstRespondedAt: new Date(), isRead: true },
      });
    } catch {
      // Best-effort — never block the response on this.
    }

    return successResponse({ sent: true });
  } catch (err) {
    logger.error('[admin/marketplaces/messages/reply] POST failed', { error: err });
    return errorResponse('Внутрішня помилка', 500);
  }
});
