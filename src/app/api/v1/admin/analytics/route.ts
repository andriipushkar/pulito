import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

/** Helper: get period comparison dates */
function getPeriods(days: number) {
  const now = new Date();
  const currentFrom = new Date();
  currentFrom.setDate(now.getDate() - days);
  const prevFrom = new Date();
  prevFrom.setDate(currentFrom.getDate() - days);
  return { currentFrom, prevFrom, prevTo: currentFrom };
}

/** Helper: percentage change */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export const GET = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type') || 'sales';
      const days = Number(searchParams.get('days')) || 30;
      const { currentFrom, prevFrom, prevTo } = getPeriods(days);

      switch (type) {
        case 'sales': {
          const [orders, prevOrders] = await Promise.all([
            prisma.order.findMany({
              where: { createdAt: { gte: currentFrom }, status: { not: 'cancelled' } },
              select: { createdAt: true, totalAmount: true },
              orderBy: { createdAt: 'asc' },
            }),
            prisma.order.findMany({
              where: { createdAt: { gte: prevFrom, lt: prevTo }, status: { not: 'cancelled' } },
              select: { totalAmount: true },
            }),
          ]);

          const daily: Record<string, { date: string; revenue: number; count: number }> = {};
          for (const o of orders) {
            const date = o.createdAt.toISOString().slice(0, 10);
            if (!daily[date]) daily[date] = { date, revenue: 0, count: 0 };
            daily[date].revenue += Number(o.totalAmount);
            daily[date].count++;
          }

          const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
          const totalOrders = orders.length;
          const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;

          const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
          const prevTotal = prevOrders.length;
          const prevAvg = prevTotal > 0 ? prevRevenue / prevTotal : 0;

          return successResponse({
            daily: Object.values(daily),
            summary: { totalRevenue, totalOrders, avgCheck },
            comparison: {
              revenue: pctChange(totalRevenue, prevRevenue),
              orders: pctChange(totalOrders, prevTotal),
              avgCheck: pctChange(avgCheck, prevAvg),
            },
          });
        }

        case 'products': {
          const topProducts = await prisma.orderItem.groupBy({
            by: ['productId', 'productName', 'productCode'],
            _sum: { quantity: true, subtotal: true },
            _count: true,
            where: { order: { createdAt: { gte: currentFrom }, status: { not: 'cancelled' } } },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 20,
          });

          const zeroSales = await prisma.product.count({
            where: {
              isActive: true,
              orderItems: { none: { order: { createdAt: { gte: currentFrom } } } },
            },
          });

          // Margin estimate: (retail - wholesale avg) / retail
          const marginProducts = await prisma.product.findMany({
            where: { isActive: true, priceWholesale: { not: null } },
            select: { id: true, name: true, code: true, priceRetail: true, priceWholesale: true },
            orderBy: { ordersCount: 'desc' },
            take: 20,
          });
          const margins = marginProducts.map((p) => {
            const retail = Number(p.priceRetail);
            const wholesale = Number(p.priceWholesale);
            const marginPct = retail > 0 ? Math.round(((retail - wholesale) / retail) * 100) : 0;
            return { id: p.id, name: p.name, code: p.code, retail, wholesale, marginPct };
          });

          return successResponse({ topProducts, zeroSales, margins });
        }

        case 'clients': {
          const [newUsers, prevNewUsers, totalUsers, wholesalers] = await Promise.all([
            prisma.user.count({ where: { createdAt: { gte: currentFrom } } }),
            prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
            prisma.user.count(),
            prisma.user.count({ where: { role: 'wholesaler' } }),
          ]);

          const topClients = await prisma.order.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: currentFrom }, status: { not: 'cancelled' }, userId: { not: null } },
            _sum: { totalAmount: true },
            _count: true,
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 10,
          });

          const clientIds = topClients.map((c) => c.userId).filter((id): id is number => id !== null);
          const clientInfo = await prisma.user.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, fullName: true, email: true, companyName: true },
          });
          const clientMap = new Map(clientInfo.map((c) => [c.id, c]));

          const topClientsWithInfo = topClients.map((c) => ({
            ...c,
            client: c.userId ? clientMap.get(c.userId) || null : null,
          }));

          // Wholesale group comparison
          const wholesaleGroups = await prisma.order.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: currentFrom }, status: { not: 'cancelled' }, userId: { not: null } },
            _sum: { totalAmount: true },
            _count: true,
          });
          const wgUserIds = wholesaleGroups.map((g) => g.userId).filter((id): id is number => id !== null);
          const wgUsers = await prisma.user.findMany({
            where: { id: { in: wgUserIds }, wholesaleGroup: { not: null } },
            select: { id: true, wholesaleGroup: true },
          });
          const wgMap = new Map(wgUsers.map((u) => [u.id, u.wholesaleGroup]));

          const groupStats: Record<number, { orders: number; revenue: number; customers: Set<number> }> = {};
          for (const g of wholesaleGroups) {
            const wg = g.userId ? wgMap.get(g.userId) : null;
            if (!wg) continue;
            if (!groupStats[wg]) groupStats[wg] = { orders: 0, revenue: 0, customers: new Set() };
            groupStats[wg].orders += g._count;
            groupStats[wg].revenue += Number(g._sum.totalAmount);
            groupStats[wg].customers.add(g.userId!);
          }
          const wholesaleGroupStats = Object.entries(groupStats).map(([group, s]) => ({
            group: Number(group),
            orders: s.orders,
            revenue: s.revenue,
            customers: s.customers.size,
            avgCheck: s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
          }));

          return successResponse({
            newUsers, totalUsers, wholesalers, topClients: topClientsWithInfo,
            comparison: { newUsers: pctChange(newUsers, prevNewUsers) },
            wholesaleGroupStats,
          });
        }

        case 'orders': {
          const [statusCounts, deliveryCounts, paymentCounts] = await Promise.all([
            prisma.order.groupBy({ by: ['status'], _count: true, where: { createdAt: { gte: currentFrom } } }),
            prisma.order.groupBy({ by: ['deliveryMethod'], _count: true, where: { createdAt: { gte: currentFrom } } }),
            prisma.order.groupBy({ by: ['paymentMethod'], _count: true, where: { createdAt: { gte: currentFrom } } }),
          ]);

          // Cancellation & return reasons
          const cancellations = await prisma.order.findMany({
            where: { createdAt: { gte: currentFrom }, status: { in: ['cancelled', 'returned'] } },
            select: { status: true, cancelledReason: true, cancelledBy: true },
          });
          const reasonCounts: Record<string, number> = {};
          for (const c of cancellations) {
            const reason = c.cancelledReason || 'Не вказано';
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          }
          const cancellationReasons = Object.entries(reasonCounts)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count);

          const cancelledCount = cancellations.filter((c) => c.status === 'cancelled').length;
          const returnedCount = cancellations.filter((c) => c.status === 'returned').length;
          const totalPeriod = statusCounts.reduce((s, c) => s + c._count, 0);
          const cancelRate = totalPeriod > 0 ? Math.round((cancelledCount / totalPeriod) * 100) : 0;
          const returnRate = totalPeriod > 0 ? Math.round((returnedCount / totalPeriod) * 100) : 0;

          // Heatmap: orders by day of week & hour
          const ordersRaw = await prisma.order.findMany({
            where: { createdAt: { gte: currentFrom } },
            select: { createdAt: true },
          });
          const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
          for (const o of ordersRaw) {
            const d = new Date(o.createdAt);
            heatmap[d.getDay()][d.getHours()]++;
          }

          return successResponse({
            statusCounts, deliveryCounts, paymentCounts,
            cancellationReasons, cancelRate, returnRate,
            heatmap,
          });
        }

        case 'funnel': {
          const funnelStats = await prisma.dailyFunnelStats.findMany({
            where: { date: { gte: currentFrom } },
            orderBy: { date: 'asc' },
          });
          return successResponse(funnelStats);
        }

        case 'dashboard': {
          // KPI dashboard — summary of key metrics
          const [
            totalRevenue, prevRevenue,
            totalOrders, prevTotalOrders,
            newUsers, prevNewUsers,
            pendingOrders, lowStockCount,
          ] = await Promise.all([
            prisma.order.aggregate({ where: { createdAt: { gte: currentFrom }, status: { not: 'cancelled' } }, _sum: { totalAmount: true } }),
            prisma.order.aggregate({ where: { createdAt: { gte: prevFrom, lt: prevTo }, status: { not: 'cancelled' } }, _sum: { totalAmount: true } }),
            prisma.order.count({ where: { createdAt: { gte: currentFrom }, status: { not: 'cancelled' } } }),
            prisma.order.count({ where: { createdAt: { gte: prevFrom, lt: prevTo }, status: { not: 'cancelled' } } }),
            prisma.user.count({ where: { createdAt: { gte: currentFrom } } }),
            prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: prevTo } } }),
            prisma.order.count({ where: { status: 'new_order' } }),
            prisma.product.count({ where: { isActive: true, quantity: { lt: 5 } } }),
          ]);

          const rev = Number(totalRevenue._sum.totalAmount) || 0;
          const prevRev = Number(prevRevenue._sum.totalAmount) || 0;
          const avgCheck = totalOrders > 0 ? rev / totalOrders : 0;
          const prevAvg = prevTotalOrders > 0 ? prevRev / prevTotalOrders : 0;

          // Auto-insights
          const insights: string[] = [];
          const revChange = pctChange(rev, prevRev);
          if (revChange !== null) {
            if (revChange > 10) insights.push(`Виручка зросла на ${revChange}% порівняно з попереднім періодом`);
            else if (revChange < -10) insights.push(`Виручка впала на ${Math.abs(revChange)}% порівняно з попереднім періодом`);
          }
          const ordChange = pctChange(totalOrders, prevTotalOrders);
          if (ordChange !== null && ordChange < -15) insights.push(`Кількість замовлень зменшилась на ${Math.abs(ordChange)}%`);
          if (pendingOrders > 5) insights.push(`${pendingOrders} замовлень очікують обробки`);
          if (lowStockCount > 0) insights.push(`${lowStockCount} товарів з критично низьким залишком (< 5 шт)`);

          const usersChange = pctChange(newUsers, prevNewUsers);
          if (usersChange !== null && usersChange > 20) insights.push(`Приплив нових користувачів зріс на ${usersChange}%`);

          // Forecast: simple linear trend
          const last7 = await prisma.order.findMany({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, status: { not: 'cancelled' } },
            select: { createdAt: true, totalAmount: true },
          });
          const dailyRev: Record<string, number> = {};
          for (const o of last7) {
            const d = o.createdAt.toISOString().slice(0, 10);
            dailyRev[d] = (dailyRev[d] || 0) + Number(o.totalAmount);
          }
          const vals = Object.values(dailyRev);
          const avgDaily = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          const forecast7 = Math.round(avgDaily * 7);
          const forecast30 = Math.round(avgDaily * 30);

          return successResponse({
            kpi: {
              revenue: rev,
              revenueChange: revChange,
              orders: totalOrders,
              ordersChange: ordChange,
              avgCheck: Math.round(avgCheck),
              avgCheckChange: pctChange(avgCheck, prevAvg),
              newUsers,
              newUsersChange: usersChange,
              pendingOrders,
              lowStockCount,
            },
            insights,
            forecast: { avgDaily: Math.round(avgDaily), forecast7, forecast30 },
          });
        }

        default:
          return errorResponse('Невідомий тип аналітики', 400);
      }
    } catch (error) {
      console.error('[Analytics]', error);
      return errorResponse('Помилка завантаження аналітики', 500);
    }
  }
);
