import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, errorResponse, parseSearchParams } from '@/utils/api-response';

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
    } catch {
      return errorResponse('Помилка завантаження повернень', 500);
    }
  }
);
