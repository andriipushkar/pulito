import { prisma } from '@/lib/prisma';
import { trackParcel } from '@/services/nova-poshta';

/**
 * Auto-check delivery status for orders with NP TTN.
 * Persists latest carrier status text and auto-completes when delivered.
 */
export async function autoTrackDeliveries(): Promise<{ checked: number; updated: number }> {
  const trackedOrders = await prisma.order.findMany({
    where: {
      trackingNumber: { not: null },
      deliveryMethod: 'nova_poshta',
      status: { in: ['confirmed', 'paid', 'shipped'] },
    },
    select: { id: true, orderNumber: true, trackingNumber: true, userId: true, status: true },
    take: 100,
  });

  let updated = 0;

  for (const order of trackedOrders) {
    if (!order.trackingNumber) continue;

    try {
      const result = await trackParcel(order.trackingNumber);
      const status = (Array.isArray(result) ? result[0] : result) as
        | { StatusCode?: string | number; Status?: string }
        | undefined;
      if (!status) continue;

      const statusCode = Number(status.StatusCode);
      const statusText = String(status.Status || '');

      // Persist latest carrier status so customer sees it without re-polling.
      await prisma.order.update({
        where: { id: order.id },
        data: { trackingStatus: statusText, trackingStatusAt: new Date() },
      });

      // StatusCode 9 = Delivered, 10/11 = Delivered (variants)
      if ((statusCode === 9 || statusCode === 11) && order.status !== 'completed') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'completed',
            statusHistory: {
              create: {
                oldStatus: order.status,
                newStatus: 'completed',
                changeSource: 'cron',
                comment: `Автоматично: посилка доставлена (ТТН ${order.trackingNumber})`,
              },
            },
          },
        });

        if (order.userId) {
          import('@/services/telegram')
            .then((mod) =>
              mod.notifyClientStatusChange(
                order.userId!,
                order.orderNumber,
                order.status,
                'completed',
                order.trackingNumber,
              ),
            )
            .catch(() => {});
        }

        updated++;
      }
    } catch {
      continue;
    }
  }

  return { checked: trackedOrders.length, updated };
}
