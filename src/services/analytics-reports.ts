import { prisma } from '@/lib/prisma';

// ──────────────────────────────────────────
// 1. Stock Analytics
// ──────────────────────────────────────────

interface StockAnalyticsResult {
  criticalStock: {
    id: number;
    code: string;
    name: string;
    quantity: number;
    avgDailySales: number;
    daysUntilOut: number | null;
  }[];
  deadStock: {
    id: number;
    code: string;
    name: string;
    quantity: number;
    lastSoldAt: string | null;
    daysSinceLastSale: number | null;
  }[];
  turnoverRates: {
    id: number;
    code: string;
    name: string;
    quantity: number;
    soldLast30: number;
    turnoverRate: number;
  }[];
  summary: {
    totalProducts: number;
    criticalCount: number;
    deadStockCount: number;
    avgTurnover: number;
  };
}

export async function getStockAnalytics(days: number = 30): Promise<StockAnalyticsResult> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // All active products with stock
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, quantity: true },
  });

  // Sales in the period
  const sales = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: { createdAt: { gte: dateFrom }, status: { notIn: ['cancelled', 'returned'] } },
    },
    _sum: { quantity: true },
  });

  // Last sale date per product
  const lastSales = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: { status: { notIn: ['cancelled', 'returned'] } },
    },
    _max: { createdAt: true },
  });

  const salesMap = new Map(sales.map((s) => [s.productId, Number(s._sum.quantity || 0)]));
  const lastSaleMap = new Map(lastSales.map((s) => [s.productId, s._max.createdAt]));

  const now = new Date();

  // Critical stock: products selling > 0 per day where stock lasts < 14 days
  const criticalStock = products
    .map((p) => {
      const sold = salesMap.get(p.id) || 0;
      const avgDailySales = sold / days;
      const daysUntilOut = avgDailySales > 0 ? p.quantity / avgDailySales : null;
      return {
        ...p,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        daysUntilOut: daysUntilOut ? Math.round(daysUntilOut) : null,
      };
    })
    .filter((p) => p.daysUntilOut !== null && p.daysUntilOut < 14 && p.quantity > 0)
    .sort((a, b) => (a.daysUntilOut ?? 999) - (b.daysUntilOut ?? 999))
    .slice(0, 50);

  // Dead stock: products with stock but no sales in 60+ days
  const deadStock = products
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const lastSold = lastSaleMap.get(p.id);
      const daysSince = lastSold
        ? Math.floor((now.getTime() - lastSold.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        ...p,
        lastSoldAt: lastSold?.toISOString() || null,
        daysSinceLastSale: daysSince,
      };
    })
    .filter((p) => p.daysSinceLastSale === null || p.daysSinceLastSale >= 60)
    .sort((a, b) => (b.daysSinceLastSale ?? 9999) - (a.daysSinceLastSale ?? 9999))
    .slice(0, 50);

  // Turnover rates
  const turnoverRates = products
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const sold = salesMap.get(p.id) || 0;
      const turnoverRate = p.quantity > 0 ? sold / p.quantity : 0;
      return { ...p, soldLast30: sold, turnoverRate: Math.round(turnoverRate * 100) / 100 };
    })
    .sort((a, b) => b.turnoverRate - a.turnoverRate)
    .slice(0, 50);

  const allTurnovers = products
    .filter((p) => p.quantity > 0)
    .map((p) => {
      const sold = salesMap.get(p.id) || 0;
      return p.quantity > 0 ? sold / p.quantity : 0;
    });
  const avgTurnover =
    allTurnovers.length > 0 ? allTurnovers.reduce((a, b) => a + b, 0) / allTurnovers.length : 0;

  return {
    criticalStock,
    deadStock,
    turnoverRates,
    summary: {
      totalProducts: products.length,
      criticalCount: criticalStock.length,
      deadStockCount: deadStock.length,
      avgTurnover: Math.round(avgTurnover * 100) / 100,
    },
  };
}

// ──────────────────────────────────────────
// 2. Price Analytics
// ──────────────────────────────────────────

interface PriceChange {
  productId: number;
  product: { name: string; code: string } | null;
  priceRetailOld: number;
  priceRetailNew: number;
  changePercent: number;
  changedAt: string;
}

interface PromoImpact {
  productId: number;
  productName: string;
  productCode: string;
  avgSalesBefore: number;
  avgSalesAfter: number;
  salesLift: number;
  revenueBefore: number;
  revenueAfter: number;
}

export async function getPriceAnalytics(days: number = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // Price changes in the period
  const priceChanges = await prisma.priceHistory.findMany({
    where: { changedAt: { gte: dateFrom } },
    include: { product: { select: { name: true, code: true } } },
    orderBy: { changedAt: 'desc' },
    take: 100,
  });

  const changes: PriceChange[] = priceChanges.map((pc) => {
    const oldPrice = Number(pc.priceRetailOld);
    const newPrice = Number(pc.priceRetailNew);
    const changePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
    return {
      productId: pc.productId,
      product: pc.product,
      priceRetailOld: oldPrice,
      priceRetailNew: newPrice,
      changePercent: Math.round(changePercent * 10) / 10,
      changedAt: pc.changedAt.toISOString(),
    };
  });

  // Promo impact: compare sales before/after promo for currently promo products
  const promoProducts = await prisma.product.findMany({
    where: { isActive: true, isPromo: true },
    select: { id: true, name: true, code: true },
    take: 20,
  });

  const promoImpact: PromoImpact[] = [];
  const halfPeriod = Math.floor(days / 2);
  const midDate = new Date();
  midDate.setDate(midDate.getDate() - halfPeriod);

  for (const p of promoProducts) {
    const [before, after] = await Promise.all([
      prisma.orderItem.aggregate({
        where: {
          productId: p.id,
          order: {
            createdAt: { gte: dateFrom, lt: midDate },
            status: { notIn: ['cancelled', 'returned'] },
          },
        },
        _sum: { quantity: true, subtotal: true },
        _count: true,
      }),
      prisma.orderItem.aggregate({
        where: {
          productId: p.id,
          order: { createdAt: { gte: midDate }, status: { notIn: ['cancelled', 'returned'] } },
        },
        _sum: { quantity: true, subtotal: true },
        _count: true,
      }),
    ]);

    const avgBefore = halfPeriod > 0 ? Number(before._sum.quantity || 0) / halfPeriod : 0;
    const avgAfter = halfPeriod > 0 ? Number(after._sum.quantity || 0) / halfPeriod : 0;
    const salesLift = avgBefore > 0 ? ((avgAfter - avgBefore) / avgBefore) * 100 : 0;

    promoImpact.push({
      productId: p.id,
      productName: p.name,
      productCode: p.code,
      avgSalesBefore: Math.round(avgBefore * 100) / 100,
      avgSalesAfter: Math.round(avgAfter * 100) / 100,
      salesLift: Math.round(salesLift),
      revenueBefore: Number(before._sum.subtotal || 0),
      revenueAfter: Number(after._sum.subtotal || 0),
    });
  }

  const summary = {
    totalChanges: changes.length,
    priceIncreases: changes.filter((c) => c.changePercent > 0).length,
    priceDecreases: changes.filter((c) => c.changePercent < 0).length,
    avgChangePercent:
      changes.length > 0
        ? Math.round((changes.reduce((s, c) => s + c.changePercent, 0) / changes.length) * 10) / 10
        : 0,
  };

  return { changes, promoImpact, summary };
}

// ──────────────────────────────────────────
// 3. Channel / UTM Analytics
// ──────────────────────────────────────────

export async function getChannelAnalytics(days: number = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // Orders by source (web, telegram_bot, viber_bot)
  const bySource = await prisma.order.groupBy({
    by: ['source'],
    where: { createdAt: { gte: dateFrom }, status: { notIn: ['cancelled'] } },
    _count: true,
    _sum: { totalAmount: true },
  });

  // Orders by UTM source
  const byUtmSource = await prisma.order.groupBy({
    by: ['utmSource'],
    where: {
      createdAt: { gte: dateFrom },
      status: { notIn: ['cancelled'] },
      utmSource: { not: null },
    },
    _count: true,
    _sum: { totalAmount: true },
  });

  // Orders by UTM medium
  const byUtmMedium = await prisma.order.groupBy({
    by: ['utmMedium'],
    where: {
      createdAt: { gte: dateFrom },
      status: { notIn: ['cancelled'] },
      utmMedium: { not: null },
    },
    _count: true,
    _sum: { totalAmount: true },
  });

  // Orders by UTM campaign
  const byUtmCampaign = await prisma.order.groupBy({
    by: ['utmCampaign'],
    where: {
      createdAt: { gte: dateFrom },
      status: { notIn: ['cancelled'] },
      utmCampaign: { not: null },
    },
    _count: true,
    _sum: { totalAmount: true },
  });

  // Channel visits with conversion
  const channelVisits = await prisma.channelVisit.groupBy({
    by: ['utmSource'],
    where: { createdAt: { gte: dateFrom } },
    _count: true,
  });

  const channelConversions = await prisma.channelVisit.groupBy({
    by: ['utmSource'],
    where: { createdAt: { gte: dateFrom }, convertedToOrder: true },
    _count: true,
  });

  const visitMap = new Map(channelVisits.map((v) => [v.utmSource, v._count]));
  const convMap = new Map(channelConversions.map((v) => [v.utmSource, v._count]));

  const channelConversionRates = [...visitMap.entries()]
    .map(([source, visits]) => {
      const conversions = convMap.get(source) || 0;
      return {
        source: source || 'direct',
        visits,
        conversions,
        conversionRate: visits > 0 ? Math.round((conversions / visits) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => b.visits - a.visits);

  return {
    bySource: bySource.map((s) => ({
      source: s.source,
      orders: s._count,
      revenue: Number(s._sum.totalAmount || 0),
    })),
    byUtmSource: byUtmSource.map((s) => ({
      utmSource: s.utmSource,
      orders: s._count,
      revenue: Number(s._sum.totalAmount || 0),
    })),
    byUtmMedium: byUtmMedium.map((s) => ({
      utmMedium: s.utmMedium,
      orders: s._count,
      revenue: Number(s._sum.totalAmount || 0),
    })),
    byUtmCampaign: byUtmCampaign.map((s) => ({
      utmCampaign: s.utmCampaign,
      orders: s._count,
      revenue: Number(s._sum.totalAmount || 0),
    })),
    channelConversionRates,
  };
}

// ──────────────────────────────────────────
// 4. Geography Analytics
// ──────────────────────────────────────────

export async function getGeographyAnalytics(days: number = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // Cap groupBy result at 500 cities — even shops shipping nationwide
  // have <300 distinct delivery destinations in any 30-day window. Without
  // a hard cap a typo-noisy city column could return thousands of rows
  // (e.g. "Kyiv" / "Київ" / "kyiv" / "Київ " each counted separately).
  // We sort by revenue at the DB level so the top entries we actually
  // care about always make it into the slice.
  const byCity = await prisma.order.groupBy({
    by: ['deliveryCity'],
    where: {
      createdAt: { gte: dateFrom },
      status: { notIn: ['cancelled'] },
      deliveryCity: { not: null },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 500,
  });

  const cities = byCity
    .filter((c) => c.deliveryCity)
    .map((c) => ({
      city: c.deliveryCity!,
      orders: c._count._all,
      revenue: Number(c._sum?.totalAmount || 0),
    }))
    .sort((a, b) => b.orders - a.orders);

  const totalOrders = cities.reduce((s, c) => s + c.orders, 0);
  const totalRevenue = cities.reduce((s, c) => s + c.revenue, 0);

  const citiesWithPercent = cities.map((c) => ({
    ...c,
    ordersPercent: totalOrders > 0 ? Math.round((c.orders / totalOrders) * 1000) / 10 : 0,
    revenuePercent: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
    avgCheck: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
  }));

  // By delivery method
  const byMethod = await prisma.order.groupBy({
    by: ['deliveryMethod'],
    where: { createdAt: { gte: dateFrom }, status: { notIn: ['cancelled'] } },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  return {
    cities: citiesWithPercent.slice(0, 50),
    totalCities: citiesWithPercent.length,
    totalOrders,
    totalRevenue,
    topCity: citiesWithPercent[0] || null,
    byDeliveryMethod: byMethod.map((m) => ({
      method: m.deliveryMethod,
      orders: m._count._all,
      revenue: Number(m._sum?.totalAmount || 0),
    })),
  };
}

// ──────────────────────────────────────────
// 5. Customer LTV
// ──────────────────────────────────────────

export async function getCustomerLTV(days: number = 365) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // Aggregate per user: total spent, order count, first/last order
  const customerStats = await prisma.order.groupBy({
    by: ['userId'],
    where: {
      userId: { not: null },
      createdAt: { gte: dateFrom },
      status: { notIn: ['cancelled', 'returned'] },
    },
    _sum: { totalAmount: true },
    _count: true,
    _min: { createdAt: true },
    _max: { createdAt: true },
  });

  const validCustomers = customerStats.filter((c) => c.userId !== null);

  // Enrichment: get user info for top customers
  const topUserIds = validCustomers
    .sort((a, b) => Number(b._sum.totalAmount || 0) - Number(a._sum.totalAmount || 0))
    .slice(0, 50)
    .map((c) => c.userId!)
    .filter(Boolean);

  const users = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, email: true, fullName: true, companyName: true, createdAt: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const ltvData = validCustomers
    .sort((a, b) => Number(b._sum.totalAmount || 0) - Number(a._sum.totalAmount || 0))
    .slice(0, 50)
    .map((c) => {
      const user = userMap.get(c.userId!);
      const totalSpent = Number(c._sum.totalAmount || 0);
      const orderCount = c._count;
      const firstOrder = c._min.createdAt!;
      const lastOrder = c._max.createdAt!;
      const lifetimeDays = Math.max(
        1,
        Math.floor((lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const monthlyValue = lifetimeDays > 0 ? (totalSpent / lifetimeDays) * 30 : totalSpent;

      return {
        userId: c.userId!,
        email: user?.email || '',
        fullName: user?.fullName || '',
        companyName: user?.companyName || null,
        totalSpent,
        orderCount,
        avgCheck: orderCount > 0 ? Math.round(totalSpent / orderCount) : 0,
        firstOrderAt: firstOrder.toISOString(),
        lastOrderAt: lastOrder.toISOString(),
        lifetimeDays,
        monthlyValue: Math.round(monthlyValue),
        projectedYearlyLTV: Math.round(monthlyValue * 12),
      };
    });

  // Summary
  const allSpends = validCustomers.map((c) => Number(c._sum.totalAmount || 0));
  const totalCustomers = validCustomers.length;
  const totalRevenue = allSpends.reduce((s, v) => s + v, 0);
  const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // LTV distribution buckets
  const buckets = [
    { label: '< 500 ₴', min: 0, max: 500 },
    { label: '500-2000 ₴', min: 500, max: 2000 },
    { label: '2000-5000 ₴', min: 2000, max: 5000 },
    { label: '5000-20000 ₴', min: 5000, max: 20000 },
    { label: '> 20000 ₴', min: 20000, max: Infinity },
  ];

  const distribution = buckets.map((b) => ({
    label: b.label,
    count: allSpends.filter((v) => v >= b.min && v < b.max).length,
    revenue: allSpends.filter((v) => v >= b.min && v < b.max).reduce((s, v) => s + v, 0),
  }));

  return {
    topCustomers: ltvData,
    summary: {
      totalCustomers,
      totalRevenue: Math.round(totalRevenue),
      avgLTV: Math.round(avgLTV),
      medianLTV:
        totalCustomers > 0
          ? Math.round(allSpends.sort((a, b) => a - b)[Math.floor(totalCustomers / 2)])
          : 0,
    },
    distribution,
  };
}

// ──────────────────────────────────────────
// 6. Customer Segmentation
// ──────────────────────────────────────────

type SegmentName =
  | 'champions'
  | 'loyal'
  | 'recent'
  | 'promising'
  | 'at_risk'
  | 'sleeping'
  | 'lost'
  | 'new';

interface CustomerSegment {
  segment: SegmentName;
  label: string;
  count: number;
  revenue: number;
  avgCheck: number;
  customers: {
    userId: number;
    email: string;
    fullName: string | null;
    lastOrderDays: number;
    orderCount: number;
    totalSpent: number;
  }[];
}

export async function getCustomerSegmentation(days: number = 365) {
  const now = new Date();
  // Bound the scan to a recency window (default 1 year) so the groupBy + the
  // follow-up user findMany can't load the entire historical customer base
  // into memory on a large, long-running shop. Segmentation targets the active
  // customer base; clients with no orders inside the window are out of scope.
  const dateFrom = new Date(now);
  dateFrom.setDate(dateFrom.getDate() - days);

  // Get all customers with orders in the window
  const customerStats = await prisma.order.groupBy({
    by: ['userId'],
    where: {
      userId: { not: null },
      status: { notIn: ['cancelled', 'returned'] },
      createdAt: { gte: dateFrom },
    },
    _sum: { totalAmount: true },
    _count: true,
    _max: { createdAt: true },
  });

  const userIds = customerStats.filter((c) => c.userId !== null).map((c) => c.userId!);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, fullName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Segment customers based on recency and frequency
  const segmented: Record<
    SegmentName,
    { count: number; revenue: number; totalOrders: number; customers: CustomerSegment['customers'] }
  > = {
    champions: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    loyal: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    recent: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    promising: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    at_risk: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    sleeping: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    lost: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
    new: { count: 0, revenue: 0, totalOrders: 0, customers: [] },
  };

  for (const c of customerStats) {
    if (!c.userId || !c._max.createdAt) continue;

    const daysSinceLastOrder = Math.floor(
      (now.getTime() - c._max.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const orderCount = c._count;
    const totalSpent = Number(c._sum.totalAmount || 0);
    const user = userMap.get(c.userId);

    let segment: SegmentName;
    if (daysSinceLastOrder <= 30 && orderCount >= 5) {
      segment = 'champions';
    } else if (daysSinceLastOrder <= 60 && orderCount >= 3) {
      segment = 'loyal';
    } else if (daysSinceLastOrder <= 30 && orderCount === 1) {
      segment = 'new';
    } else if (daysSinceLastOrder <= 30 && orderCount >= 2) {
      segment = 'recent';
    } else if (daysSinceLastOrder <= 90 && orderCount >= 2) {
      segment = 'promising';
    } else if (daysSinceLastOrder <= 180) {
      segment = 'at_risk';
    } else if (daysSinceLastOrder <= 365) {
      segment = 'sleeping';
    } else {
      segment = 'lost';
    }

    segmented[segment].count++;
    segmented[segment].revenue += totalSpent;
    segmented[segment].totalOrders += orderCount;
    if (segmented[segment].customers.length < 10) {
      segmented[segment].customers.push({
        userId: c.userId,
        email: user?.email || '',
        fullName: user?.fullName || null,
        lastOrderDays: daysSinceLastOrder,
        orderCount,
        totalSpent: Math.round(totalSpent),
      });
    }
  }

  const SEGMENT_LABELS: Record<SegmentName, string> = {
    champions: 'Чемпіони',
    loyal: 'Лояльні',
    recent: 'Недавні',
    promising: 'Перспективні',
    at_risk: 'Під загрозою',
    sleeping: 'Сплячі',
    lost: 'Втрачені',
    new: 'Нові',
  };

  const segments: CustomerSegment[] = (
    Object.entries(segmented) as [SegmentName, (typeof segmented)[SegmentName]][]
  ).map(([key, data]) => ({
    segment: key,
    label: SEGMENT_LABELS[key],
    count: data.count,
    revenue: Math.round(data.revenue),
    avgCheck: data.totalOrders > 0 ? Math.round(data.revenue / data.totalOrders) : 0,
    customers: data.customers,
  }));

  return {
    segments,
    totalCustomers: customerStats.length,
    totalRevenue: Math.round(
      customerStats.reduce((s, c) => s + Number(c._sum.totalAmount || 0), 0),
    ),
  };
}

// ──────────────────────────────────────────
// 7. Order Processing Time
// ──────────────────────────────────────────

interface ProcessingTimeStats {
  /** Average duration in hours, rounded to 1 decimal */
  avgHours: number;
  /** Median duration in hours */
  medianHours: number;
  /** 95th percentile duration in hours */
  p95Hours: number;
  /** Number of orders included in the calculation */
  sampleSize: number;
  /** Targeted statuses (e.g., from new_order to shipped) */
  fromStatus: string;
  toStatus: string;
}

/**
 * Compute average processing time between two order statuses, using
 * OrderStatusHistory transitions over the requested window.
 *
 * Default window: 30 days; default measurement: new_order → shipped.
 */
export async function getOrderProcessingTime(
  days: number = 30,
  fromStatus: string = 'new_order',
  toStatus: string = 'shipped',
): Promise<ProcessingTimeStats> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  // Find all "to" transitions in the window, then look up the matching
  // "from" transition for the same order.
  const toTransitions = await prisma.orderStatusHistory.findMany({
    where: {
      newStatus: toStatus,
      createdAt: { gte: dateFrom },
    },
    select: { orderId: true, createdAt: true },
  });

  if (toTransitions.length === 0) {
    return {
      avgHours: 0,
      medianHours: 0,
      p95Hours: 0,
      sampleSize: 0,
      fromStatus,
      toStatus,
    };
  }

  const orderIds = toTransitions.map((t) => t.orderId);

  const fromTransitions = await prisma.orderStatusHistory.findMany({
    where: {
      orderId: { in: orderIds },
      newStatus: fromStatus,
    },
    select: { orderId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const firstFromByOrder = new Map<number, Date>();
  for (const row of fromTransitions) {
    if (!firstFromByOrder.has(row.orderId)) {
      firstFromByOrder.set(row.orderId, row.createdAt);
    }
  }

  const durationsHours: number[] = [];
  for (const t of toTransitions) {
    const start = firstFromByOrder.get(t.orderId);
    if (!start) continue;
    const ms = t.createdAt.getTime() - start.getTime();
    if (ms <= 0) continue;
    durationsHours.push(ms / 3_600_000);
  }

  if (durationsHours.length === 0) {
    return {
      avgHours: 0,
      medianHours: 0,
      p95Hours: 0,
      sampleSize: 0,
      fromStatus,
      toStatus,
    };
  }

  durationsHours.sort((a, b) => a - b);
  const sum = durationsHours.reduce((s, v) => s + v, 0);
  const avg = sum / durationsHours.length;
  const median = durationsHours[Math.floor(durationsHours.length / 2)];
  const p95Index = Math.min(durationsHours.length - 1, Math.floor(durationsHours.length * 0.95));
  const p95 = durationsHours[p95Index];

  return {
    avgHours: Math.round(avg * 10) / 10,
    medianHours: Math.round(median * 10) / 10,
    p95Hours: Math.round(p95 * 10) / 10,
    sampleSize: durationsHours.length,
    fromStatus,
    toStatus,
  };
}
