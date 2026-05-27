import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { updateBadgeSchema } from '@/validators/badge';

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateBadgeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const d = parsed.data;

    // Snapshot before-state. Flipping `isLocked` is policy-sensitive
    // (immune to cron cleanup); audit needs to show the change.
    const before = await prisma.productBadge.findUnique({
      where: { id: numId },
      select: { isLocked: true, isActive: true, badgeType: true, priority: true },
    });
    if (!before) return errorResponse('Бейдж не знайдено', 404);

    const data: Record<string, unknown> = {};
    if (d.badgeType !== undefined) data.badgeType = d.badgeType;
    if (d.customText !== undefined) data.customText = d.customText ?? null;
    if (d.customColor !== undefined) data.customColor = d.customColor ?? null;
    if (d.priority !== undefined) data.priority = d.priority;
    if (d.isActive !== undefined) data.isActive = d.isActive;
    if (d.isLocked !== undefined) data.isLocked = d.isLocked;

    try {
      const badge = await prisma.productBadge.update({ where: { id: numId }, data });
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'product_badge',
        entityId: numId,
        // Cast through object — Prisma `Json` field rejects
        // `Record<string, unknown>` from generic mapping.
        details: { fields: Object.keys(d), before, after: data } as object,
        ipAddress: getClientIp(request),
      });
      return successResponse(badge);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'P2025') return errorResponse('Бейдж не знайдено', 404);
        if (code === 'P2002')
          return errorResponse('Бейдж цього типу вже існує для цього товару', 409);
      }
      throw err;
    }
  } catch (err) {
    logger.error('[admin/badges/[id]] PUT failed', { error: err });
    return errorResponse('Помилка оновлення бейджа', 500);
  }
});

export const DELETE = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Snapshot for audit so we record which product/type pair was removed.
    const before = await prisma.productBadge.findUnique({
      where: { id: numId },
      select: { productId: true, badgeType: true, isLocked: true },
    });
    if (!before) return errorResponse('Бейдж не знайдено', 404);

    try {
      await prisma.productBadge.delete({ where: { id: numId } });
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'product_badge',
        entityId: numId,
        details: before,
        ipAddress: getClientIp(request),
      });
      return successResponse({ deleted: true });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return errorResponse('Бейдж не знайдено', 404);
      }
      throw err;
    }
  } catch (err) {
    logger.error('[admin/badges/[id]] DELETE failed', { error: err });
    return errorResponse('Помилка видалення бейджа', 500);
  }
});
