import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

      const rule = await prisma.moderationRule.findUnique({
        where: { id: numId },
        include: {
          _count: { select: { logs: true } },
          logs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!rule) {
        return errorResponse('Правило не знайдено', 404);
      }

      return successResponse(rule);
    } catch (err) {
      logger.error('[admin/moderation/rules/[id]] GET failed', { error: err });
      return errorResponse('Помилка завантаження правила', 500);
    }
  }
);

export const PUT = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();

      const validPlatforms = ['telegram', 'viber'];
      const validRuleTypes = ['stop_words', 'link_block', 'flood_limit'];
      const validActions = ['delete', 'warn', 'ban'];

      if (body.platform && !validPlatforms.includes(body.platform)) {
        return errorResponse(`Допустимі platform: ${validPlatforms.join(', ')}`, 400);
      }
      if (body.ruleType && !validRuleTypes.includes(body.ruleType)) {
        return errorResponse(`Допустимі ruleType: ${validRuleTypes.join(', ')}`, 400);
      }
      if (body.action && !validActions.includes(body.action)) {
        return errorResponse(`Допустимі action: ${validActions.join(', ')}`, 400);
      }

      // Cap the JSON config size — `body.config` was previously accepted as
      // arbitrary nested JSON with no upper bound. ~16 KB is enough for any
      // sensible rule set (a few thousand stop-words).
      if (body.config !== undefined) {
        const serialized = JSON.stringify(body.config ?? {});
        if (serialized.length > 16_384) {
          return errorResponse('config надто великий (макс 16 KB)', 400);
        }
      }

      const rule = await prisma.moderationRule.update({
        where: { id: numId },
        data: {
          ...(body.platform && { platform: body.platform }),
          ...(body.ruleType && { ruleType: body.ruleType }),
          ...(body.config && { config: body.config }),
          ...(body.action && { action: body.action }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
      });

      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'moderation_rule',
        entityId: numId,
        details: { fields: Object.keys(body) },
      });

      return successResponse(rule);
    } catch (err) {
      logger.error('[admin/moderation/rules/[id]] PUT failed', { error: err });
      return errorResponse('Помилка оновлення правила', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      await prisma.moderationRule.delete({ where: { id: numId } });
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'moderation_rule',
        entityId: numId,
      });
      return successResponse({ deleted: true });
    } catch (err) {
      logger.error('[admin/moderation/rules/[id]] DELETE failed', { error: err });
      return errorResponse('Помилка видалення правила', 500);
    }
  }
);
