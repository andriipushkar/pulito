import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { MARKETPLACE_PLATFORMS } from '@/services/marketplace-health';
import { paginatedResponse, errorResponse, parseSearchParams } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parseSearchParams(searchParams);
    const source = searchParams.get('source') || undefined;
    const event = searchParams.get('event') || undefined;
    const status = searchParams.get('status') || undefined; // 'ok' | 'error'
    const sinceParam = searchParams.get('since') || undefined;

    const where: Record<string, unknown> = {
      source: { in: MARKETPLACE_PLATFORMS as readonly string[] as string[] },
    };
    if (source) where.source = source;
    if (event) where.event = event;
    if (status === 'error') where.error = { not: null };
    if (status === 'ok') where.error = null;
    if (sinceParam) {
      const since = new Date(sinceParam);
      if (!Number.isNaN(since.getTime())) {
        where.processedAt = { gte: since };
      }
    }

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhookLog.count({ where }),
    ]);

    return paginatedResponse(logs, total, page, limit);
  } catch (err) {
    logger.error('[admin/marketplaces/webhook-log] GET failed', { error: err });
    return errorResponse('Помилка завантаження журналу', 500);
  }
});
