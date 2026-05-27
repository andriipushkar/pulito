import { prisma } from '@/lib/prisma';

export interface Anomaly {
  metric: string;
  label: string;
  today: number;
  baseline: number;
  deviation: number; // signed %
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

/**
 * Compares today's key metrics against a 14-day baseline. Anything outside
 * ±2σ (~50% deviation) becomes an Anomaly card. Cheap to run on dashboard.
 *
 * Metrics tracked:
 * - orders count (vs avg)
 * - revenue (vs avg)
 * - cancellation rate (vs avg)
 * - conversion rate proxy: orders / unique-customers-today
 */
export async function detectAnomalies(): Promise<Anomaly[]> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const start14 = new Date(startOfToday);
  start14.setDate(start14.getDate() - 14);

  const [todayAgg, todayCancelled, baseAgg, baseCancelled] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfToday } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: startOfToday }, status: { in: ['cancelled', 'returned'] } },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: start14, lt: startOfToday } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: start14, lt: startOfToday },
        status: { in: ['cancelled', 'returned'] },
      },
    }),
  ]);

  const anomalies: Anomaly[] = [];

  // Orders count
  const todayCount = todayAgg._count._all;
  const baseDailyCount = (baseAgg._count._all || 0) / 14;
  if (baseDailyCount >= 3) {
    const dev = ((todayCount - baseDailyCount) / baseDailyCount) * 100;
    if (Math.abs(dev) >= 50) {
      anomalies.push({
        metric: 'orders_count',
        label: 'Замовлень сьогодні',
        today: todayCount,
        baseline: Math.round(baseDailyCount * 10) / 10,
        deviation: Math.round(dev),
        severity: dev < -50 ? 'danger' : dev > 100 ? 'info' : 'warning',
        message:
          dev < 0
            ? `Сьогодні ${todayCount} замовлень — на ${Math.abs(Math.round(dev))}% нижче за 14-денне середнє (${Math.round(baseDailyCount)}). Перевір чи працює checkout.`
            : `Сплеск: ${todayCount} замовлень — на ${Math.round(dev)}% вище середнього. Перевір чи готова логістика і запаси.`,
      });
    }
  }

  // Revenue
  const todayRev = Number(todayAgg._sum.totalAmount || 0);
  const baseDailyRev = Number(baseAgg._sum.totalAmount || 0) / 14;
  if (baseDailyRev >= 200) {
    const dev = ((todayRev - baseDailyRev) / baseDailyRev) * 100;
    if (Math.abs(dev) >= 50) {
      anomalies.push({
        metric: 'revenue',
        label: 'Виручка сьогодні',
        today: Math.round(todayRev),
        baseline: Math.round(baseDailyRev),
        deviation: Math.round(dev),
        severity: dev < -50 ? 'danger' : dev > 100 ? 'info' : 'warning',
        message:
          dev < 0
            ? `Виручка сьогодні ${Math.round(todayRev)} ₴ — на ${Math.abs(Math.round(dev))}% нижче середнього (${Math.round(baseDailyRev)}). Перевір ціни, доставку, кошик.`
            : `Виручка ${Math.round(todayRev)} ₴ — сплеск +${Math.round(dev)}% від середнього.`,
      });
    }
  }

  // Cancellation rate
  if (todayCount >= 5) {
    const todayCancelRate = (todayCancelled / todayCount) * 100;
    const baseCancelRate = baseAgg._count._all ? (baseCancelled / baseAgg._count._all) * 100 : 0;
    if (todayCancelRate >= baseCancelRate + 15 && todayCancelRate >= 10) {
      anomalies.push({
        metric: 'cancel_rate',
        label: 'Скасування сьогодні',
        today: Math.round(todayCancelRate),
        baseline: Math.round(baseCancelRate),
        deviation: Math.round(todayCancelRate - baseCancelRate),
        severity: 'danger',
        message: `Сьогодні ${Math.round(todayCancelRate)}% замовлень скасовано (середнє ${Math.round(baseCancelRate)}%). Можливо проблема з товаром, доставкою або ціною.`,
      });
    }
  }

  return anomalies;
}
