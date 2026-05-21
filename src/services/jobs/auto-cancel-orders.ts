import { prisma } from '@/lib/prisma';
import { updateOrderStatus } from '@/services/order';
import { logger } from '@/lib/logger';

const AUTO_CANCEL_HOURS = 72;

/**
 * Auto-cancel orders stuck in 'new_order' status for more than 72 hours.
 * Returns the number of cancelled orders.
 */
export async function autoCancelStaleOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_HOURS * 60 * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: 'new_order',
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderNumber: true, userId: true },
  });

  if (staleOrders.length === 0) return 0;

  let cancelled = 0;
  for (const order of staleOrders) {
    try {
      // Delegate to updateOrderStatus instead of writing the order row
      // directly. That path restores Product.quantity, releases
      // WarehouseStock.reserved, refunds any loyalty points spent, and
      // writes a properly-typed statusHistory row — none of which the
      // previous direct prisma.order.update did.
      await updateOrderStatus(
        order.id,
        'cancelled',
        null,
        'cron',
        'Автоматичне скасування: замовлення не оброблено протягом 72 годин',
      );
      cancelled++;
    } catch (err) {
      logger.warn('[auto-cancel] order update failed', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    // Notify client if they have Telegram linked
    if (order.userId) {
      import('@/services/telegram')
        .then((mod) =>
          mod.notifyClientStatusChange(
            order.userId!,
            order.orderNumber,
            'new_order',
            'cancelled'
          )
        )
        .catch(() => {});
    }
  }

  return cancelled;
}
