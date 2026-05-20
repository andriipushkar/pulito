import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Light-weight counters used by the admin sidebar to render badges.
// Kept separate from the dashboard stats endpoint so the sidebar can poll
// every 60s without doing 10+ aggregations each time.
export const GET = withRole('admin', 'manager')(async () => {
  try {
    const [newOrders, newFeedback, pendingWholesale] = await Promise.all([
      prisma.order.count({ where: { status: 'new_order', deletedAt: null } }),
      prisma.feedback.count({ where: { status: 'new_feedback' } }),
      prisma.user.count({ where: { wholesaleStatus: 'pending' } }),
    ]);

    return successResponse({ newOrders, newFeedback, pendingWholesale });
  } catch (err) {
    logger.error('[admin/sidebar-counts] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
