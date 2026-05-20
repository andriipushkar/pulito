import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const POST = withRole('admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const sourceId = Number(id);
      if (isNaN(sourceId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const targetId = Number(body.targetCategoryId);
      if (!targetId || isNaN(targetId)) return errorResponse('targetCategoryId обов\'язковий', 400);
      if (sourceId === targetId) return errorResponse('Не можна об\'єднати категорію саму з собою', 400);

      const [source, target] = await Promise.all([
        prisma.category.findUnique({ where: { id: sourceId }, include: { _count: { select: { products: true } } } }),
        prisma.category.findUnique({ where: { id: targetId } }),
      ]);

      if (!source) return errorResponse('Вихідну категорію не знайдено', 404);
      if (!target) return errorResponse('Цільову категорію не знайдено', 404);

      // All four ops are dependent — wrap in a single tx so a mid-merge crash
      // can't leave products on the source while subcategories already moved.
      const movedProducts = source._count.products;
      await prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: { categoryId: sourceId },
          data: { categoryId: targetId },
        });
        await tx.category.updateMany({
          where: { parentId: sourceId },
          data: { parentId: targetId },
        });
        await tx.category.delete({ where: { id: sourceId } });
      });

      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'category_merge',
        entityId: sourceId,
        details: { sourceId, targetId, movedProducts },
      });

      await cacheInvalidate('categories:*');

      return successResponse({ merged: true, movedProducts });
    } catch (err) {
      logger.error('[admin/categories/[id]/merge] POST failed', { error: err });
      return errorResponse('Помилка об\'єднання категорій', 500);
    }
  }
);
