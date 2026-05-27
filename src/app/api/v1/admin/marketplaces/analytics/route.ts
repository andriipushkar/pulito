import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { MARKETPLACE_PLATFORMS, type MarketplacePlatform } from '@/services/marketplace-health';
import { getChannelConfig } from '@/services/channel-config';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

interface PlatformStats {
  platform: string;
  orders: number;
  revenue: number;
  commissionPercent: number;
  commission: number;
  netRevenue: number;
  avgOrder: number;
  publishedCount: number;
}

// Clamp config value to a sane range. Anything outside 0..50% is almost
// certainly a typo (Ukrainian marketplaces top out around 25%).
function parseCommissionPercent(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 50) return 50;
  return n;
}

interface TopProduct {
  productCode: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export const GET = withRole(
  'admin',
  'manager',
)(async (req: NextRequest) => {
  try {
    const { searchParams } = req.nextUrl;
    const periodKey = searchParams.get('period') || '30d';
    const days = PERIOD_DAYS[periodKey] || 30;
    const periodMs = days * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - periodMs);
    // Comparison window: the previous chunk of the same length, immediately
    // before the current period. Lets the UI render "+X% vs попередні N днів"
    // deltas on the totals tiles.
    const prevSince = new Date(since.getTime() - periodMs);
    const prevUntil = since;

    const [prevAgg] = await prisma.$queryRaw<Array<{ orders: bigint; revenue: number }>>`
      SELECT COUNT(*)::bigint as orders,
             COALESCE(SUM("total_amount"), 0)::float as revenue
      FROM orders
      WHERE "source" IN ('olx', 'rozetka', 'prom', 'epicentrk')
        AND "created_at" >= ${prevSince}
        AND "created_at" < ${prevUntil}
        AND "status" <> 'cancelled';
    `;
    const prevOrders = Number(prevAgg?.orders ?? 0);
    const prevRevenue = prevAgg?.revenue ?? 0;

    // Per-platform orders + revenue. Computed in parallel across all 4
    // marketplaces — the inner Promise.all already parallelizes the three
    // queries per platform, so this wraps the outer loop too. ~4× faster
    // dashboard load on a warm DB.
    const perPlatform = await Promise.all(
      MARKETPLACE_PLATFORMS.map(async (platform) => {
        const [orders, publishedCount, config] = await Promise.all([
          prisma.order.findMany({
            where: {
              source: platform as MarketplacePlatform,
              createdAt: { gte: since },
              status: { notIn: ['cancelled'] },
            },
            select: { totalAmount: true, id: true },
          }),
          prisma.publicationChannel.count({
            where: { channel: platform, status: 'published' },
          }),
          getChannelConfig(platform as MarketplacePlatform),
        ]);

        const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const commissionPercent = parseCommissionPercent(
          (config as Record<string, unknown> | null)?.commissionPercent,
        );
        const commission = revenue * (commissionPercent / 100);
        const netRevenue = revenue - commission;

        let top: TopProduct[] = [];
        if (orders.length > 0) {
          const items = await prisma.orderItem.groupBy({
            by: ['productCode', 'productName'],
            where: { orderId: { in: orders.map((o) => o.id) } },
            _sum: { quantity: true, subtotal: true },
            orderBy: { _sum: { subtotal: 'desc' } },
            take: 5,
          });
          top = items.map((it) => ({
            productCode: it.productCode,
            productName: it.productName,
            quantity: it._sum.quantity || 0,
            revenue: Math.round(Number(it._sum.subtotal || 0) * 100) / 100,
          }));
        }

        return {
          stats: {
            platform,
            orders: orders.length,
            revenue: Math.round(revenue * 100) / 100,
            commissionPercent,
            commission: Math.round(commission * 100) / 100,
            netRevenue: Math.round(netRevenue * 100) / 100,
            avgOrder: orders.length > 0 ? Math.round((revenue / orders.length) * 100) / 100 : 0,
            publishedCount,
          } as PlatformStats,
          top,
        };
      }),
    );

    const platformStats: PlatformStats[] = perPlatform.map((p) => p.stats);
    const topByPlatform: Record<string, TopProduct[]> = {};
    for (const p of perPlatform) topByPlatform[p.stats.platform] = p.top;

    // Daily revenue series (last `days` days, all platforms combined)
    const dailyRaw = await prisma.$queryRaw<Array<{ day: Date; revenue: number; orders: bigint }>>`
      SELECT DATE_TRUNC('day', "created_at") as day,
             COALESCE(SUM("total_amount"), 0)::float as revenue,
             COUNT(*)::bigint as orders
      FROM orders
      WHERE "source" IN ('olx', 'rozetka', 'prom', 'epicentrk')
        AND "created_at" >= ${since}
        AND "status" <> 'cancelled'
      GROUP BY 1
      ORDER BY 1 ASC;
    `;
    const daily = dailyRaw.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      revenue: r.revenue,
      orders: Number(r.orders),
    }));

    const totalOrders = platformStats.reduce((s, p) => s + p.orders, 0);
    const totalRevenue = platformStats.reduce((s, p) => s + p.revenue, 0);
    const totalCommission = platformStats.reduce((s, p) => s + p.commission, 0);
    const totalNetRevenue = totalRevenue - totalCommission;

    return successResponse({
      period: periodKey,
      since: since.toISOString(),
      totals: {
        orders: totalOrders,
        revenue: Math.round(totalRevenue * 100) / 100,
        commission: Math.round(totalCommission * 100) / 100,
        netRevenue: Math.round(totalNetRevenue * 100) / 100,
        avgOrder: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
      },
      previousTotals: {
        orders: prevOrders,
        revenue: Math.round(prevRevenue * 100) / 100,
      },
      platforms: platformStats,
      topProducts: topByPlatform,
      daily,
    });
  } catch (err) {
    logger.error('[admin/marketplaces/analytics] GET failed', { error: err });
    const message = err instanceof Error ? err.message : 'Помилка аналітики';
    return errorResponse(message, 500);
  }
});
