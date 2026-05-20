import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit, sortOrder } = parseSearchParams(searchParams);
      const platform = searchParams.get('platform') || undefined;
      const ruleId = searchParams.get('ruleId');
      const actionTaken = searchParams.get('actionTaken') || undefined;
      const isFalsePositive = searchParams.get('isFalsePositive');

      const where = {
        ...(platform && { platform }),
        ...(ruleId && { ruleId: Number(ruleId) }),
        ...(actionTaken && { actionTaken }),
        ...(isFalsePositive !== null && isFalsePositive !== undefined && isFalsePositive !== '' && {
          isFalsePositive: isFalsePositive === 'true',
        }),
      };

      const [logs, total] = await Promise.all([
        prisma.moderationLog.findMany({
          where,
          orderBy: { createdAt: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            rule: { select: { id: true, ruleType: true, platform: true, action: true } },
          },
        }),
        prisma.moderationLog.count({ where }),
      ]);

      return paginatedResponse(logs, total, page, limit);
    } catch (err) {
      logger.error('[admin/moderation/logs] GET failed', { error: err });
      return errorResponse('Помилка завантаження журналу модерації', 500);
    }
  }
);

export const PATCH = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      if (!body.id) {
        return errorResponse('id обов\'язковий', 400);
      }

      const log = await prisma.moderationLog.update({
        where: { id: Number(body.id) },
        data: { isFalsePositive: body.isFalsePositive ?? true },
      });

      return successResponse(log);
    } catch (err) {
      logger.error('[admin/moderation/logs] PATCH failed', { error: err });
      return errorResponse('Помилка оновлення запису', 500);
    }
  }
);
