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
import { createModerationRuleSchema } from '@/validators/moderation';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parseSearchParams(searchParams);
    const platform = searchParams.get('platform') || undefined;
    const ruleType = searchParams.get('ruleType') || undefined;
    const isActive = searchParams.get('isActive');

    const where = {
      ...(platform && { platform }),
      ...(ruleType && { ruleType }),
      ...(isActive !== null &&
        isActive !== undefined &&
        isActive !== '' && { isActive: isActive === 'true' }),
    };

    const validSortFields = [
      'id',
      'platform',
      'ruleType',
      'action',
      'isActive',
      'createdAt',
      'updatedAt',
    ];
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
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createModerationRuleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Soft dup-guard: two identical (platform, ruleType) rules confuse
    // the bot pipeline (which one wins?). Tell the operator to edit the
    // existing one instead of stacking copies.
    const dupe = await prisma.moderationRule.findFirst({
      where: { platform: parsed.data.platform, ruleType: parsed.data.ruleType },
      select: { id: true },
    });
    if (dupe) {
      return errorResponse(
        `Правило ${parsed.data.platform}/${parsed.data.ruleType} вже існує (id=${dupe.id}). Відредагуйте його замість створення дубля.`,
        409,
      );
    }

    const rule = await prisma.moderationRule.create({
      data: {
        platform: parsed.data.platform,
        ruleType: parsed.data.ruleType,
        // Cast through `object` — Prisma's Json input type doesn't accept
        // `Record<string, unknown>` directly from Zod's `z.record` output.
        config: parsed.data.config as object,
        action: parsed.data.action,
        isActive: parsed.data.isActive ?? true,
      },
    });

    // `action: 'ban'` rules can affect many users — track who created it.
    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'moderation_rule',
      entityId: rule.id,
      details: {
        platform: rule.platform,
        ruleType: rule.ruleType,
        action: rule.action,
      },
      ipAddress: getClientIp(request),
    });

    return successResponse(rule, 201);
  } catch (err) {
    logger.error('[admin/moderation/rules] POST failed', { error: err });
    return errorResponse('Помилка створення правила модерації', 500);
  }
});
