import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Buckets surfaced in the AttentionPanel above the orders list — same idea
// as the marketplace panel: revenue-critical states should never be hiding
// in column filters. Counts are cheap (prisma.count over indexed columns).
//
// Thresholds chosen against typical fulfillment SLA:
//   - 24h without a tracking number → courier handoff is late
//   - 24h pending payment           → cart-abandonment, may need a nudge
//   -  3d stuck in processing       → warehouse delay, manager intervention
//
// The panel shows zero counts as a quiet "✓ Все ок" badge so operators
// learn to trust the absence of badges (vs wondering if the data loaded).
export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;

    const [withoutTtn24h, unpaid24h, stuckProcessing3d] = await Promise.all([
      // Orders that have moved past 'new_order' but still have no tracking
      // number, and the customer has been waiting >24h.
      prisma.order.count({
        where: {
          trackingNumber: null,
          deliveryMethod: 'nova_poshta',
          status: { in: ['confirmed', 'paid', 'processing'] },
          createdAt: { lt: new Date(now - 24 * HOUR) },
        },
      }),
      // Pending-payment orders older than 24h — usually abandoned carts,
      // but sometimes failed Liqpay/wayforpay redirects. Worth checking.
      prisma.order.count({
        where: {
          paymentStatus: 'pending',
          status: { in: ['new_order', 'confirmed'] },
          createdAt: { lt: new Date(now - 24 * HOUR) },
        },
      }),
      // Processing > 72h is a warehouse pickup/pack stall. Manager should
      // either ship or downgrade status with a customer note.
      prisma.order.count({
        where: {
          status: 'processing',
          updatedAt: { lt: new Date(now - 72 * HOUR) },
        },
      }),
    ]);

    return successResponse({
      withoutTtn24h,
      unpaid24h,
      stuckProcessing3d,
    });
  } catch (err) {
    logger.error('[admin/orders/attention] GET failed', { error: err });
    return errorResponse('Помилка завантаження лічильників', 500);
  }
});
