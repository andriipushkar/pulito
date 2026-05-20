import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

interface RestockSuggestion {
  productId: number;
  windowDays: number;
  soldInWindow: number;
  velocityPerDay: number;
  daysOfStock: number | null;
  /** Recommended re-order quantity (covers next 30 days, rounded to 10). */
  suggestedQuantity: number;
  rationale: string;
}

const WINDOW_DAYS = 30;
const COVERAGE_DAYS = 30;

export const GET = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const productId = Number(id);
      if (isNaN(productId)) return errorResponse('Невалідний ID', 400);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, quantity: true, isActive: true },
      });
      if (!product) return errorResponse('Товар не знайдено', 404);

      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const sold = await prisma.orderItem.aggregate({
        where: {
          productId,
          order: { createdAt: { gte: since }, status: { notIn: ['cancelled', 'returned'] } },
        },
        _sum: { quantity: true },
      });

      const soldInWindow = Number(sold._sum.quantity || 0);
      const velocityPerDay = soldInWindow / WINDOW_DAYS;
      const daysOfStock =
        velocityPerDay > 0 ? Math.floor(product.quantity / velocityPerDay) : null;

      // Suggest covering next COVERAGE_DAYS days, minus current stock, rounded
      // up to nearest 10 for a friendlier reorder number.
      const target = Math.ceil(velocityPerDay * COVERAGE_DAYS) - product.quantity;
      const suggestedQuantity = Math.max(0, Math.ceil(target / 10) * 10);

      const rationale =
        soldInWindow === 0
          ? `За останні ${WINDOW_DAYS} днів продажів не було — поточний залишок ${product.quantity} шт.`
          : `Продано ${soldInWindow} шт за ${WINDOW_DAYS} днів (≈ ${velocityPerDay.toFixed(1)}/день). ${
              daysOfStock !== null
                ? `Поточного залишку (${product.quantity}) вистачить на ~${daysOfStock} дн.`
                : ''
            }`;

      const result: RestockSuggestion = {
        productId,
        windowDays: WINDOW_DAYS,
        soldInWindow,
        velocityPerDay: Math.round(velocityPerDay * 100) / 100,
        daysOfStock,
        suggestedQuantity,
        rationale,
      };
      return successResponse(result);
    } catch (err) {
      logger.error('[admin/products/[id]/restock-suggestion] GET failed', { error: err });
      return errorResponse('Не вдалося обчислити пропозицію', 500);
    }
  },
);
