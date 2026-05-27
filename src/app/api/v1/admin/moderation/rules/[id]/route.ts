import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { updateModerationRuleSchema } from '@/validators/moderation';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
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
});

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateModerationRuleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    // Verify the rule exists first so a missing id returns a friendly 404
    // instead of a raw Prisma P2025.
    const existing = await prisma.moderationRule.findUnique({
      where: { id: numId },
      select: { id: true },
    });
    if (!existing) return errorResponse('Правило не знайдено', 404);

    // Prisma `Json` columns reject `Record<string, unknown>` from Zod
    // directly — cast through `InputJsonValue` so the typed validator
    // output still lands in the right field.
    const updateData: Record<string, unknown> = {};
    if (parsed.data.platform) updateData.platform = parsed.data.platform;
    if (parsed.data.ruleType) updateData.ruleType = parsed.data.ruleType;
    if (parsed.data.config) updateData.config = parsed.data.config as object;
    if (parsed.data.action) updateData.action = parsed.data.action;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const rule = await prisma.moderationRule.update({
      where: { id: numId },
      data: updateData,
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'moderation_rule',
      entityId: numId,
      details: { fields: Object.keys(parsed.data) },
      ipAddress: getClientIp(request),
    });

    return successResponse(rule);
  } catch (err) {
    logger.error('[admin/moderation/rules/[id]] PUT failed', { error: err });
    return errorResponse('Помилка оновлення правила', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Snapshot affected-logs count before deletion so audit forensics can
    // report "rule X deleted, N historical triggers orphaned". The FK on
    // ModerationLog.ruleId is optional, so logs survive with ruleId=null.
    const affectedLogs = await prisma.moderationLog.count({ where: { ruleId: numId } });

    const existing = await prisma.moderationRule.findUnique({
      where: { id: numId },
      select: { platform: true, ruleType: true, action: true },
    });
    if (!existing) return errorResponse('Правило не знайдено', 404);

    await prisma.moderationRule.delete({ where: { id: numId } });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'moderation_rule',
      entityId: numId,
      details: {
        platform: existing.platform,
        ruleType: existing.ruleType,
        action: existing.action,
        orphanedLogs: affectedLogs,
      },
      ipAddress: getClientIp(request),
    });
    return successResponse({ deleted: true, orphanedLogs: affectedLogs });
  } catch (err) {
    logger.error('[admin/moderation/rules/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення правила', 500);
  }
});
