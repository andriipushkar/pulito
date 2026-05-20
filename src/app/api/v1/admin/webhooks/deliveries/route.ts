import { NextRequest } from 'next/server';
import type { Prisma } from '@/../generated/prisma';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Paginated list of webhook deliveries with filters. Lets the admin drill
// into "show me all failed `order.created` retries this week" without paging
// through every subscription's last-delivery card.
export const GET = withRole('admin')(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));
    const subscriptionId = searchParams.get('subscriptionId')
      ? Number(searchParams.get('subscriptionId'))
      : undefined;
    const event = searchParams.get('event') || undefined;
    const statusFilter = searchParams.get('status'); // 'success' | 'failed'

    const where: Prisma.WebhookDeliveryWhereInput = {};
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (event) where.event = event;
    if (statusFilter === 'success') {
      where.statusCode = { gte: 200, lt: 300 };
    } else if (statusFilter === 'failed') {
      where.OR = [{ statusCode: { gte: 400 } }, { statusCode: null }];
    }

    const [items, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          subscriptionId: true,
          event: true,
          statusCode: true,
          error: true,
          attempt: true,
          durationMs: true,
          createdAt: true,
          subscription: { select: { name: true, url: true } },
        },
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    return paginatedResponse(items, total, page, limit);
  } catch (err) {
    logger.error('[admin/webhooks/deliveries] GET failed', { error: err });
    return errorResponse('Помилка завантаження доставок', 500);
  }
});
