import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  parseSearchParams,
} from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { updateModerationLogSchema } from '@/validators/moderation';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
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
      ...(isFalsePositive !== null &&
        isFalsePositive !== undefined &&
        isFalsePositive !== '' && {
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
});

export const PATCH = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = updateModerationLogSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Verify log exists so a missing id returns 404, not Prisma P2025.
    const existing = await prisma.moderationLog.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, isFalsePositive: true, ruleId: true, platform: true },
    });
    if (!existing) return errorResponse('Запис не знайдено', 404);

    const log = await prisma.moderationLog.update({
      where: { id: parsed.data.id },
      data: { isFalsePositive: parsed.data.isFalsePositive ?? true },
    });

    // Flipping isFalsePositive is effectively a policy override — model
    // training, ban appeals, and audit need to see who marked what.
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'moderation_log',
      entityId: parsed.data.id,
      details: {
        before: { isFalsePositive: existing.isFalsePositive },
        after: { isFalsePositive: log.isFalsePositive },
        ruleId: existing.ruleId,
        platform: existing.platform,
      },
      ipAddress: getClientIp(request),
    });

    return successResponse(log);
  } catch (err) {
    logger.error('[admin/moderation/logs] PATCH failed', { error: err });
    return errorResponse('Помилка оновлення запису', 500);
  }
});
