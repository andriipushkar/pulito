import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { cacheInvalidate } from '@/services/cache';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  action: z.enum(['show', 'hide', 'delete', 'setParent']),
  parentId: z.number().int().positive().optional().nullable(),
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const { ids, action, parentId } = parsed.data;

    if (action === 'show' || action === 'hide') {
      await prisma.category.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { isVisible: action === 'show' },
      });
    } else if (action === 'setParent') {
      if (parentId !== null && parentId !== undefined && ids.includes(parentId)) {
        return errorResponse('Не можна зробити батьком одну з обраних категорій', 400);
      }
      await prisma.category.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { parentId: parentId ?? null },
      });
    } else if (action === 'delete') {
      // Refuse if any of them have products attached — admin must reassign first.
      const blockedByProducts = await prisma.category.findMany({
        where: { id: { in: ids }, products: { some: {} } },
        select: { id: true, name: true },
      });
      if (blockedByProducts.length > 0) {
        return errorResponse(
          `Не вдалося видалити: у категорій ${blockedByProducts.map((b) => `"${b.name}"`).join(', ')} є товари. Перенесіть товари спочатку.`,
          409,
        );
      }
      // Also refuse if any has active child categories — would orphan
      // children with a deleted parentId, breaking navigation tree.
      const blockedByChildren = await prisma.category.findMany({
        where: {
          id: { in: ids },
          children: { some: { deletedAt: null } },
        },
        select: { id: true, name: true },
      });
      if (blockedByChildren.length > 0) {
        return errorResponse(
          `Не вдалося видалити: у категорій ${blockedByChildren.map((b) => `"${b.name}"`).join(', ')} ` +
            `є підкатегорії. Спочатку перенесіть або видаліть їх.`,
          409,
        );
      }
      await prisma.category.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date(), isVisible: false },
      });
    }

    await logAudit({
      userId: user.id,
      actionType: action === 'delete' ? 'data_delete' : 'data_update',
      entityType: 'category',
      details: { bulk: true, action, ids, parentId },
      ipAddress: getClientIp(request),
    });

    await cacheInvalidate('categories:*');
    await cacheInvalidate('products:*');

    try {
      revalidatePath('/catalog');
      revalidatePath('/');
      if (action === 'delete') revalidatePath('/sitemap.xml');
    } catch {
      /* best-effort */
    }

    return successResponse({ affected: ids.length });
  } catch (err) {
    logger.error('[admin/categories/bulk] POST failed', { error: err });
    return errorResponse('Помилка bulk-операції', 500);
  }
});
