import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const PUT = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
      return errorResponse('orderedIds є обовʼязковим масивом', 400);
    }
    if (!orderedIds.every((id) => Number.isInteger(id) && id > 0)) {
      return errorResponse('orderedIds має містити лише додатні цілі числа', 400);
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      return errorResponse('orderedIds не може містити дублікатів', 400);
    }

    // Lock the requested rows in id order, refuse if the set of banners
    // has changed since the admin opened the page (another tab added or
    // removed a banner). This prevents one tab's stale drag-drop from
    // silently re-ordering more (or fewer) rows than the user saw.
    await prisma.$transaction(async (tx) => {
      const sorted = [...orderedIds].sort((a, b) => a - b);
      await tx.$queryRaw`
          SELECT id FROM banners WHERE id = ANY(${sorted}::int[]) FOR UPDATE
        `;
      const liveCount = await tx.banner.count({ where: { id: { in: sorted } } });
      if (liveCount !== orderedIds.length) {
        throw new Error('Список банерів змінився — оновіть сторінку');
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.banner.update({
          where: { id: orderedIds[i] },
          data: { sortOrder: i },
        });
      }
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'banner_reorder',
      details: { count: orderedIds.length },
    });
    try {
      revalidatePath('/');
    } catch {
      /* best-effort */
    }

    return successResponse({ reordered: true });
  } catch (err) {
    logger.error('[admin/banners/reorder] PUT failed', { error: err });
    return errorResponse('Помилка зміни порядку', 500);
  }
});
