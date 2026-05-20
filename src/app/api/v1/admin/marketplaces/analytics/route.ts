import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { MARKETPLACE_PLATFORMS, type MarketplacePlatform } from '@/services/marketplace-health';
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
  avgOrder: number;
  publishedCount: number;
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
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Per-platform orders + revenue
    const platformStats: PlatformStats[] = [];
    const topByPlatform: Record<string, TopProduct[]> = {};

    for (const platform of MARKETPLACE_PLATFORMS) {
      const [orders, publishedCount] = await Promise.all([
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
      ]);

      const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      platformStats.push({
        platform,
        orders: orders.length,
        revenue: Math.round(revenue * 100) / 100,
        avgOrder: orders.length > 0 ? Math.round((revenue / orders.length) * 100) / 100 : 0,
        publishedCount,
      });

      // Top products
      if (orders.length > 0) {
        const items = await prisma.orderItem.groupBy({
          by: ['productCode', 'productName'],
          where: { orderId: { in: orders.map((o) => o.id) } },
          _sum: { quantity: true, subtotal: true },
          orderBy: { _sum: { subtotal: 'desc' } },
          take: 5,
        });
        topByPlatform[platform] = items.map((it) => ({
          productCode: it.productCode,
          productName: it.productName,
          quantity: it._sum.quantity || 0,
          revenue: Math.round(Number(it._sum.subtotal || 0) * 100) / 100,
        }));
      } else {
        topByPlatform[platform] = [];
      }
    }

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

    return successResponse({
      period: periodKey,
      since: since.toISOString(),
      totals: {
        orders: totalOrders,
        revenue: Math.round(totalRevenue * 100) / 100,
        avgOrder:
          totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
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
