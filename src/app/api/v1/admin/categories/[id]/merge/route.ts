import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';

export const POST = withRole('admin')(
  async (request: NextRequest, { params }) => {
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

      // Move all products from source to target
      await prisma.product.updateMany({
        where: { categoryId: sourceId },
        data: { categoryId: targetId },
      });

      // Move child categories from source to target
      await prisma.category.updateMany({
        where: { parentId: sourceId },
        data: { parentId: targetId },
      });

      // Mark source as merged (store info) then delete
      await prisma.category.update({
        where: { id: sourceId },
        data: { mergedFrom: `Merged into ${target.name} (id: ${targetId})` },
      });

      await prisma.category.delete({ where: { id: sourceId } });

      await cacheInvalidate('categories:*');

      return successResponse({ merged: true, movedProducts: source._count.products });
    } catch {
      return errorResponse('Помилка об\'єднання категорій', 500);
    }
  }
);
