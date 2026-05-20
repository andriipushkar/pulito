import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { OrderSource } from '@/../generated/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const MARKETPLACE_SOURCES: OrderSource[] = [
  OrderSource.olx,
  OrderSource.rozetka,
  OrderSource.prom,
  OrderSource.epicentrk,
];

/**
 * Aggregated pick-list for all unfulfilled marketplace orders.
 * Returns: { rows: [{ productCode, productName, totalQuantity, orders: [{ orderNumber, platform, quantity }] }], totalItems }
 *
 * Use case: warehouse worker pulls this once a day and walks the shelves
 * collecting all units across every marketplace at once.
 */
export const GET = withRole('admin', 'manager')(async () => {
  try {
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          source: { in: MARKETPLACE_SOURCES },
          status: { in: ['new_order', 'processing', 'confirmed', 'paid'] },
        },
      },
      include: {
        order: { select: { orderNumber: true, source: true, status: true } },
      },
    });

    const map = new Map<
      string,
      {
        productCode: string;
        productName: string;
        totalQuantity: number;
        orders: { orderNumber: string; platform: string; quantity: number; status: string }[];
      }
    >();

    for (const it of items) {
      const row = map.get(it.productCode);
      if (row) {
        row.totalQuantity += it.quantity;
        row.orders.push({
          orderNumber: it.order.orderNumber,
          platform: it.order.source || 'unknown',
          quantity: it.quantity,
          status: it.order.status,
        });
      } else {
        map.set(it.productCode, {
          productCode: it.productCode,
          productName: it.productName,
          totalQuantity: it.quantity,
          orders: [
            {
              orderNumber: it.order.orderNumber,
              platform: it.order.source || 'unknown',
              quantity: it.quantity,
              status: it.order.status,
            },
          ],
        });
      }
    }

    const rows = [...map.values()].sort((a, b) => b.totalQuantity - a.totalQuantity);
    const totalItems = rows.reduce((s, r) => s + r.totalQuantity, 0);

    return successResponse({ rows, totalItems, totalProducts: rows.length });
  } catch (err) {
    logger.error('[admin/marketplaces/pick-list] GET failed', { error: err });
    return errorResponse('Помилка завантаження pick-list', 500);
  }
});
