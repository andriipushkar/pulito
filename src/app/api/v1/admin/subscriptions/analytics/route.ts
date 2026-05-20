import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Subscription business metrics for the admin dashboard.
// Numbers are cheap-to-compute aggregations; for cohort/retention charts we'd
// want a materialised view, but for the admin one-pager raw queries are fine.
export const GET = withRole(
  'manager',
  'admin',
)(async () => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    const [
      activeCount,
      pausedCount,
      cancelledCount,
      newLast30,
      cancelledLast30,
      cancelReasons,
      ltvAgg,
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'paused' } }),
      prisma.subscription.count({ where: { status: 'cancelled' } }),
      prisma.subscription.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.subscription.count({
        where: { cancelledAt: { gte: thirtyDaysAgo } },
      }),
      // groupBy cancelReason — null buckets handled separately
      prisma.subscription.groupBy({
        by: ['cancelReason'],
        where: { status: 'cancelled' },
        _count: { _all: true },
      }),
      // LTV: sum of completed-order total per subscription owner, averaged
      prisma.$queryRaw<{ avg_ltv: number | null; n: number }[]>`
        SELECT
          COALESCE(AVG(per_user), 0)::float AS avg_ltv,
          COUNT(*)::int AS n
        FROM (
          SELECT s.user_id, COALESCE(SUM(o.total_amount), 0)::float AS per_user
          FROM subscriptions s
          LEFT JOIN orders o ON o.user_id = s.user_id AND o.status NOT IN ('cancelled', 'returned')
          GROUP BY s.user_id
        ) sub
      `,
    ]);

    // Churn rate over the last 30 days. Denominator = active + cancelled at
    // start of window — approximated with current counts; close enough for an
    // admin headline number.
    const churnDenominator = activeCount + cancelledLast30 + pausedCount;
    const churnRate30d =
      churnDenominator > 0 ? Math.round((cancelledLast30 / churnDenominator) * 1000) / 10 : 0;

    return successResponse({
      counts: {
        active: activeCount,
        paused: pausedCount,
        cancelled: cancelledCount,
      },
      flow30d: {
        newSubscriptions: newLast30,
        cancellations: cancelledLast30,
        churnRatePct: churnRate30d,
      },
      cancelReasons: cancelReasons.map((r) => ({
        reason: r.cancelReason ?? 'unknown',
        count: r._count._all,
      })),
      ltv: {
        average: ltvAgg[0]?.avg_ltv ?? 0,
        sampleSize: ltvAgg[0]?.n ?? 0,
      },
    });
  } catch (err) {
    logger.error('[admin/subscriptions/analytics] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити аналітику', 500);
  }
});
