import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit, sortBy, sortOrder } = parseSearchParams(searchParams);
      const platform = searchParams.get('platform') || undefined;
      const ruleType = searchParams.get('ruleType') || undefined;
      const isActive = searchParams.get('isActive');

      const where = {
        ...(platform && { platform }),
        ...(ruleType && { ruleType }),
        ...(isActive !== null && isActive !== undefined && isActive !== '' && { isActive: isActive === 'true' }),
      };

      const validSortFields = ['id', 'platform', 'ruleType', 'action', 'isActive', 'createdAt', 'updatedAt'];
      const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

      const [rules, total] = await Promise.all([
        prisma.moderationRule.findMany({
          where,
          orderBy: { [orderField]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: { _count: { select: { logs: true } } },
        }),
        prisma.moderationRule.count({ where }),
      ]);

      return paginatedResponse(rules, total, page, limit);
    } catch (err) {
      logger.error('[admin/moderation/rules] GET failed', { error: err });
      return errorResponse('Помилка завантаження правил модерації', 500);
    }
  }
);

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      const validPlatforms = ['telegram', 'viber'];
      const validRuleTypes = ['stop_words', 'link_block', 'flood_limit'];
      const validActions = ['delete', 'warn', 'ban'];

      if (!body.platform || !validPlatforms.includes(body.platform)) {
        return errorResponse(`platform обов'язковий. Допустимі: ${validPlatforms.join(', ')}`, 400);
      }
      if (!body.ruleType || !validRuleTypes.includes(body.ruleType)) {
        return errorResponse(`ruleType обов'язковий. Допустимі: ${validRuleTypes.join(', ')}`, 400);
      }
      if (!body.action || !validActions.includes(body.action)) {
        return errorResponse(`action обов'язковий. Допустимі: ${validActions.join(', ')}`, 400);
      }
      if (!body.config || typeof body.config !== 'object') {
        return errorResponse('config обов\'язковий (JSON)', 400);
      }

      const rule = await prisma.moderationRule.create({
        data: {
          platform: body.platform,
          ruleType: body.ruleType,
          config: body.config,
          action: body.action,
          isActive: body.isActive ?? true,
        },
      });

      return successResponse(rule, 201);
    } catch (err) {
      logger.error('[admin/moderation/rules] POST failed', { error: err });
      return errorResponse('Помилка створення правила модерації', 500);
    }
  }
);
