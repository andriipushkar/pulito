import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * Returns the last ~20 events across orders + payments. Lightweight: pulls
 * the most recent orders and order-status-history rows, merges, sorts. No
 * dedicated activity table — that would duplicate data and need a write hook
 * on every mutation. For 20 rows the merge cost is negligible.
 */
export const GET = withRole('admin', 'manager')(async () => {
  try {
    const [recentOrders, recentStatusChanges] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          contactName: true,
          createdAt: true,
        },
      }),
      prisma.orderStatusHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          orderId: true,
          newStatus: true,
          oldStatus: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
        },
      }),
    ]);

    const events = [
      ...recentOrders.map((o) => ({
        type: 'order_created' as const,
        id: `o-${o.id}`,
        message: `Нове замовлення №${o.orderNumber} від ${o.contactName} на ${Number(o.totalAmount)} грн`,
        href: `/admin/orders/${o.id}`,
        at: o.createdAt,
      })),
      ...recentStatusChanges
        .filter((s) => s.oldStatus !== null)
        .map((s) => ({
          type: 'status_changed' as const,
          id: `s-${s.id}`,
          message: `№${s.order.orderNumber}: ${s.oldStatus} → ${s.newStatus}`,
          href: `/admin/orders/${s.orderId}`,
          at: s.createdAt,
        })),
    ];

    events.sort((a, b) => b.at.getTime() - a.at.getTime());

    return successResponse(events.slice(0, 20));
  } catch (error) {
    console.error('[Dashboard activity]', error);
    return errorResponse('Помилка', 500);
  }
});
