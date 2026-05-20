import { prisma } from '@/lib/prisma';
import { todayKyiv, daysAgoKyiv } from '@/utils/format';

const LOW_STOCK_THRESHOLD = 5;

export async function getDashboardStats() {
  const today = todayKyiv();
  const yesterday = daysAgoKyiv(1);
  const weekAgo = daysAgoKyiv(7);

  const [
    todayOrders,
    yesterdayOrders,
    newOrders,
    totalUsers,
    wholesalers,
    newUsersWeek,
    pendingWholesale,
    totalProducts,
    outOfStockProducts,
    lowStockProducts,
    productsWithoutBarcode,
    topProducts,
    recentOrdersRows,
    weeklyOrdersRaw,
  ] = await Promise.all([
    // Today's orders
    prisma.order.aggregate({
      where: { createdAt: { gte: today } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    // Yesterday's orders
    prisma.order.aggregate({
      where: { createdAt: { gte: yesterday, lt: today } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    // New (unprocessed) orders
    prisma.order.count({ where: { status: 'new_order' } }),
    // Total users
    prisma.user.count(),
    // Wholesalers
    prisma.user.count({ where: { role: 'wholesaler' } }),
    // New users this week
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    // Pending wholesale requests
    prisma.user.count({ where: { wholesaleStatus: 'pending' } }),
    // Total products
    prisma.product.count({ where: { isActive: true } }),
    // Out of stock
    prisma.product.count({ where: { isActive: true, quantity: 0 } }),
    // Low stock (1..LOW_STOCK_THRESHOLD)
    prisma.product.count({
      where: { isActive: true, quantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
    }),
    // Active products missing a barcode — limits marketplace listings + scanner
    prisma.product.count({
      where: { isActive: true, barcode: null },
    }),
    // Top products by orders (last 30 days)
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        order: { createdAt: { gte: daysAgoKyiv(30) } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    // Recent orders (last 5)
    prisma.order.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        contactName: true,
        createdAt: true,
      },
    }),
    // Weekly revenue (last 7 days) — raw rows aggregated in JS to keep it portable
    prisma.order.findMany({
      where: { createdAt: { gte: weekAgo }, deletedAt: null },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  const topProductIds = topProducts
    .map((p) => p.productId)
    .filter((id): id is number => id !== null);

  const topProductDetails = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];

  const detailsById = new Map(topProductDetails.map((p) => [p.id, p]));

  // Bucket weekly revenue by Kyiv day. Iterate 7 days oldest→newest so the chart reads left→right.
  const weeklyBuckets = new Map<string, { revenue: number; count: number }>();
  for (let i = 6; i >= 0; i--) {
    const day = daysAgoKyiv(i);
    weeklyBuckets.set(day.toISOString().slice(0, 10), { revenue: 0, count: 0 });
  }
  for (const o of weeklyOrdersRaw) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const bucket = weeklyBuckets.get(key);
    if (bucket) {
      bucket.revenue += Number(o.totalAmount);
      bucket.count += 1;
    }
  }
  const weeklyRevenue = [...weeklyBuckets.entries()].map(([date, v]) => ({
    date,
    revenue: v.revenue,
    count: v.count,
  }));

  // Today's orders bucketed by Kyiv hour (0..23). Helps spot peak times
  // for staffing / dispatch.
  const todayOrdersRaw = await prisma.order.findMany({
    where: { createdAt: { gte: today }, deletedAt: null },
    select: { createdAt: true, totalAmount: true },
  });
  const hourlyToday = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    revenue: 0,
  }));
  // Kyiv is UTC+2/+3. We localize to "Europe/Kyiv" to honour DST.
  const kyivHour = (d: Date) => {
    const parts = new Intl.DateTimeFormat('uk-UA', {
      timeZone: 'Europe/Kyiv',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hh = parts.find((p) => p.type === 'hour')?.value ?? '0';
    return Number(hh) % 24;
  };
  for (const o of todayOrdersRaw) {
    const h = kyivHour(o.createdAt);
    hourlyToday[h].count += 1;
    hourlyToday[h].revenue += Number(o.totalAmount);
  }

  return {
    orders: {
      todayCount: todayOrders._count,
      todayRevenue: Number(todayOrders._sum.totalAmount || 0),
      yesterdayCount: yesterdayOrders._count,
      yesterdayRevenue: Number(yesterdayOrders._sum.totalAmount || 0),
      newCount: newOrders,
    },
    users: {
      total: totalUsers,
      wholesalers,
      newThisWeek: newUsersWeek,
      pendingWholesale,
    },
    products: {
      total: totalProducts,
      outOfStock: outOfStockProducts,
      lowStock: lowStockProducts,
      withoutBarcode: productsWithoutBarcode,
    },
    topProducts: topProducts
      .map((p) => {
        const details = p.productId !== null ? detailsById.get(p.productId) : undefined;
        return {
          id: p.productId,
          name: details?.name ?? 'Невідомий товар',
          slug: details?.slug ?? null,
          quantity: p._sum.quantity || 0,
        };
      })
      .filter((p) => p.id !== null),
    recentOrders: recentOrdersRows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      contactName: o.contactName,
      createdAt: o.createdAt.toISOString(),
    })),
    weeklyRevenue,
    hourlyToday,
  };
}
