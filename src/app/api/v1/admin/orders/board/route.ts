import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Statuses shown on the kanban board. Terminal states (cancelled/returned)
// are intentionally excluded — they're not drop targets and would clutter
// the operational view.
const BOARD_STATUSES = [
  'new_order',
  'processing',
  'confirmed',
  'paid',
  'shipped',
  'completed',
] as const;

// Sane upper bound — if a shop ever has >2000 active orders, the kanban view
// is unusable anyway and they need filtered list views, not a wall of cards.
// The previous implementation capped silently at limit=100 (the generic API
// max), which hid the 101st card from drag-and-drop without warning.
const BOARD_HARD_CAP = 2000;

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: [...BOARD_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      take: BOARD_HARD_CAP,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        contactName: true,
        contactPhone: true,
        trackingNumber: true,
        createdAt: true,
      },
    });
    const totalActive = await prisma.order.count({
      where: { status: { in: [...BOARD_STATUSES] } },
    });
    return successResponse({
      orders,
      total: totalActive,
      truncated: totalActive > BOARD_HARD_CAP,
      cap: BOARD_HARD_CAP,
    });
  } catch (err) {
    logger.error('[admin/orders/board] GET failed', { error: err });
    return errorResponse('Помилка завантаження дошки', 500);
  }
});
