import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { updateFlag, deleteFlag } from '@/services/feature-flag';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const PATCH = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { key } = await params!;
    const body = await request.json();

    if (body.rolloutPercent !== undefined) {
      const p = Number(body.rolloutPercent);
      if (!Number.isInteger(p) || p < 0 || p > 100) {
        return errorResponse('rolloutPercent має бути цілим у діапазоні 0–100', 400);
      }
    }
    if (body.targetRoles !== undefined) {
      if (
        !Array.isArray(body.targetRoles) ||
        !body.targetRoles.every((r: unknown) => typeof r === 'string')
      ) {
        return errorResponse('targetRoles має бути масивом рядків', 400);
      }
    }
    if (body.targetUserIds !== undefined) {
      if (
        !Array.isArray(body.targetUserIds) ||
        !body.targetUserIds.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)
      ) {
        return errorResponse('targetUserIds має бути масивом додатних цілих чисел', 400);
      }
    }

    // Optimistic-lock: if client sent expectedUpdatedAt, ensure the row
    // hasn't moved since they read it. Concurrent admin edits otherwise
    // silently clobber each other (last-write-wins).
    if (body.expectedUpdatedAt) {
      const current = await prisma.featureFlag.findUnique({
        where: { key },
        select: { updatedAt: true },
      });
      if (current && new Date(body.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
        return errorResponse('Цей фічефлаг змінений в іншій сесії. Перезавантажте сторінку.', 409);
      }
    }

    // Snapshot the BEFORE state so audit shows real diff, not just
    // "fields touched". Useful for incident response — "who turned off
    // payment_enabled at 03:14 last night?".
    const before = await prisma.featureFlag.findUnique({
      where: { key },
      select: {
        isEnabled: true,
        rolloutPercent: true,
        targetRoles: true,
        targetUserIds: true,
        description: true,
      },
    });

    const flag = await updateFlag(key, {
      description: body.description,
      isEnabled: body.isEnabled,
      rolloutPercent: body.rolloutPercent,
      targetRoles: body.targetRoles,
      targetUserIds: body.targetUserIds,
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'feature_flag',
      entityId: flag.id,
      details: {
        key,
        fields: Object.keys(body),
        before,
        after: {
          isEnabled: flag.isEnabled,
          rolloutPercent: flag.rolloutPercent,
          targetRoles: flag.targetRoles,
          targetUserIds: flag.targetUserIds,
          description: flag.description,
        },
      },
    });

    return successResponse(flag);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse('Фічефлаг не знайдено', 404);
    }
    logger.error('[admin/feature-flags/[key]] PATCH failed', { error });
    return errorResponse('Помилка оновлення фічефлага', 500);
  }
});

export const DELETE = withRole2fa('admin')(async (_request: NextRequest, { params, user }) => {
  try {
    const { key } = await params!;
    await deleteFlag(key);
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'feature_flag',
      details: { key },
    });
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse('Фічефлаг не знайдено', 404);
    }
    logger.error('[admin/feature-flags/[key]] DELETE failed', { error });
    return errorResponse('Помилка видалення фічефлага', 500);
  }
});
