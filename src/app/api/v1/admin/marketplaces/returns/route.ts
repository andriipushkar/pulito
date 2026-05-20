import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse, successResponse, parseSearchParams } from '@/utils/api-response';
import { syncReturns } from '@/services/marketplace-sync';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parseSearchParams(searchParams);
      const status = searchParams.get('status') || undefined;
      const platform = searchParams.get('platform') || undefined;

      const where: Record<string, unknown> = {};

      if (status) {
        where.status = status;
      }

      if (platform) {
        where.connection = { platform };
      }

      const [returns, total] = await Promise.all([
        prisma.marketplaceReturn.findMany({
          where,
          include: {
            connection: { select: { platform: true } },
            order: { select: { id: true, orderNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.marketplaceReturn.count({ where }),
      ]);

      return paginatedResponse(returns, total, page, limit);
    } catch (err) {
      logger.error('[admin/marketplaces/returns] GET failed', { error: err });
      return errorResponse('Помилка завантаження повернень', 500);
    }
  }
);

export const POST = withRole('admin')(async () => {
  try {
    const result = await syncReturns();
    return successResponse(result);
  } catch (error) {
    logger.error('[admin/marketplaces/returns] POST failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка синхронізації повернень';
    return errorResponse(message, 500);
  }
});
