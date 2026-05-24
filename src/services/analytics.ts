import { prisma } from '@/lib/prisma';

export class AnalyticsError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

/**
 * Conversion funnel: aggregated DailyFunnelStats for a date range.
 */
export async function getConversionFunnel(days: number) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const stats = await prisma.dailyFunnelStats.findMany({
    where: { date: { gte: dateFrom } },
  });

  const totals = {
    pageViews: 0,
    productViews: 0,
    addToCartCount: 0,
    cartViews: 0,
    checkoutStarts: 0,
    ordersCompleted: 0,
    totalRevenue: 0,
    uniqueVisitors: 0,
  };

  for (const s of stats) {
    totals.pageViews += s.pageViews;
    totals.productViews += s.productViews;
    totals.addToCartCount += s.addToCartCount;
    totals.cartViews += s.cartViews;
    totals.checkoutStarts += s.checkoutStarts;
    totals.ordersCompleted += s.ordersCompleted;
    totals.totalRevenue += Number(s.totalRevenue);
    totals.uniqueVisitors += s.uniqueVisitors;
  }

  const steps = [
    { name: 'Перегляди сторінок', value: totals.pageViews },
    { name: 'Перегляди товарів', value: totals.productViews },
    { name: 'Додавання в кошик', value: totals.addToCartCount },
    { name: 'Перегляди кошика', value: totals.cartViews },
    { name: 'Початок оформлення', value: totals.checkoutStarts },
    { name: 'Завершені замовлення', value: totals.ordersCompleted },
  ];

  // Calculate conversion rates
  const stepsWithRates = steps.map((step, i) => ({
    ...step,
    conversionFromPrev:
      i === 0 ? 100 : steps[i - 1].value > 0 ? (step.value / steps[i - 1].value) * 100 : 0,
    conversionFromFirst: steps[0].value > 0 ? (step.value / steps[0].value) * 100 : 0,
  }));

  return { steps: stepsWithRates, totals };
}

/**
 * Cohort analysis: users grouped by registration month,
 * showing % who placed orders in subsequent months.
 */
export async function getCohortAnalysis(months: number = 6) {
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - months);

  // Get users registered in the period
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: dateFrom } },
    select: { id: true, createdAt: true },
  });

  // Get their orders
  const userIds = users.map((u) => u.id);
  const orders = await prisma.order.findMany({
    where: {
      userId: { in: userIds },
      status: { not: 'cancelled' },
    },
    select: { userId: true, createdAt: true },
  });

  // Group users by registration month (YYYY-MM)
  const cohorts: Record<
    string,
    { users: Set<number>; ordersByMonth: Record<string, Set<number>> }
  > = {};
  const userRegMonth = new Map<number, string>();

  for (const user of users) {
    const regMonth = user.createdAt.toISOString().slice(0, 7);
    userRegMonth.set(user.id, regMonth);
    if (!cohorts[regMonth]) {
      cohorts[regMonth] = { users: new Set(), ordersByMonth: {} };
    }
    cohorts[regMonth].users.add(user.id);
  }

  for (const order of orders) {
    if (!order.userId) continue;
    const regMonth = userRegMonth.get(order.userId);
    if (!regMonth) continue;

    const orderMonth = order.createdAt.toISOString().slice(0, 7);

    if (cohorts[regMonth]) {
      if (!cohorts[regMonth].ordersByMonth[orderMonth]) {
        cohorts[regMonth].ordersByMonth[orderMonth] = new Set();
      }
      cohorts[regMonth].ordersByMonth[orderMonth].add(order.userId);
    }
  }

  // Calculate retention percentages
  const result = Object.entries(cohorts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const totalUsers = data.users.size;
      const retentionMonths: Record<string, number> = {};

      for (const [orderMonth, userSet] of Object.entries(data.ordersByMonth)) {
        retentionMonths[orderMonth] = totalUsers > 0 ? (userSet.size / totalUsers) * 100 : 0;
      }

      return {
        cohort: month,
        totalUsers,
        retention: retentionMonths,
      };
    });

  return result;
}

/**
 * ABC analysis: classify products by revenue contribution.
 * A: 80% of revenue, B: next 15%, C: remaining 5%.
 */
export async function getABCAnalysis(days: number) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const productRevenues = await prisma.orderItem.groupBy({
    by: ['productId', 'productCode', 'productName'],
    where: {
      order: { createdAt: { gte: dateFrom }, status: { not: 'cancelled' } },
    },
    _sum: { subtotal: true, quantity: true },
    _count: true,
    orderBy: { _sum: { subtotal: 'desc' } },
  });

  const totalRevenue = productRevenues.reduce((sum, p) => sum + Number(p._sum.subtotal || 0), 0);

  let cumulativeRevenue = 0;
  const classified = productRevenues.map((p) => {
    const revenue = Number(p._sum.subtotal || 0);
    cumulativeRevenue += revenue;
    const cumulativePercent = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 0;

    let category: 'A' | 'B' | 'C';
    if (cumulativePercent <= 80) {
      category = 'A';
    } else if (cumulativePercent <= 95) {
      category = 'B';
    } else {
      category = 'C';
    }

    return {
      productId: p.productId,
      productCode: p.productCode,
      productName: p.productName,
      revenue,
      quantity: Number(p._sum.quantity || 0),
      orders: p._count,
      revenuePercent: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      cumulativePercent,
      category,
    };
  });

  const summary = {
    A: classified.filter((p) => p.category === 'A').length,
    B: classified.filter((p) => p.category === 'B').length,
    C: classified.filter((p) => p.category === 'C').length,
    totalRevenue,
    totalProducts: classified.length,
  };

  return { products: classified, summary };
}
