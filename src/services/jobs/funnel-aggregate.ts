import { prisma } from '@/lib/prisma';
import { kyivDateIso, kyivMidnightUtc, kyivNextDayUtc, todayKyivIso } from '@/utils/format';

interface AggregateResult {
  date: string;
  rowsWritten: number;
  totalEvents: number;
}

interface DeviceBucket {
  pageViews: number;
  productViews: number;
  addToCartCount: number;
  cartViews: number;
  checkoutStarts: number;
  ordersCompleted: number;
  totalRevenue: number;
  uniqueSessions: Set<string>;
}

function emptyBucket(): DeviceBucket {
  return {
    pageViews: 0,
    productViews: 0,
    addToCartCount: 0,
    cartViews: 0,
    checkoutStarts: 0,
    ordersCompleted: 0,
    totalRevenue: 0,
    uniqueSessions: new Set(),
  };
}

function deviceFromMetadata(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>;
    if (typeof m.device === 'string') return m.device;
  }
  return 'unknown';
}

function trafficSourceFromMetadata(metadata: unknown): string {
  if (metadata && typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>;
    if (typeof m.utm_source === 'string') return m.utm_source;
    if (typeof m.source === 'string') return m.source;
  }
  return 'direct';
}

/**
 * Aggregate ClientEvent rows for a given Kyiv calendar day into DailyFunnelStats,
 * grouped by (deviceType, trafficSource). Events are selected by Kyiv day
 * boundaries (DST-aware); the `date` column is @db.Date, so it stores the Kyiv
 * calendar date itself (UTC-midnight Date object, not the shifted boundary).
 *
 * Idempotent: existing rows for the same (date, deviceType, trafficSource) are deleted first.
 */
export async function aggregateFunnelStats(targetDate: Date): Promise<AggregateResult> {
  const dayIso = kyivDateIso(targetDate);
  const dayStart = kyivMidnightUtc(dayIso);
  const dayEnd = kyivNextDayUtc(dayIso);
  const dateCol = new Date(`${dayIso}T00:00:00Z`);

  const events = await prisma.clientEvent.findMany({
    where: { createdAt: { gte: dayStart, lt: dayEnd } },
    select: {
      eventType: true,
      sessionId: true,
      orderId: true,
      metadata: true,
    },
  });

  if (events.length === 0) {
    await prisma.dailyFunnelStats.deleteMany({ where: { date: dateCol } });
    return { date: dayIso, rowsWritten: 0, totalEvents: 0 };
  }

  const buckets = new Map<string, DeviceBucket>();
  const orderIdsCounted = new Set<number>();
  const orderRevenueByKey = new Map<string, number>();

  for (const e of events) {
    const device = deviceFromMetadata(e.metadata);
    const traffic = trafficSourceFromMetadata(e.metadata);
    const key = `${device}|${traffic}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = emptyBucket();
      buckets.set(key, bucket);
    }

    if (e.sessionId) bucket.uniqueSessions.add(e.sessionId);

    switch (e.eventType) {
      case 'page_view':
        bucket.pageViews++;
        break;
      case 'product_view':
        bucket.productViews++;
        break;
      case 'add_to_cart':
        bucket.addToCartCount++;
        break;
      case 'cart_view':
        bucket.cartViews++;
        break;
      case 'checkout_started':
        bucket.checkoutStarts++;
        break;
      case 'order_completed':
        if (e.orderId && !orderIdsCounted.has(e.orderId)) {
          orderIdsCounted.add(e.orderId);
          bucket.ordersCompleted++;
          if (e.metadata && typeof e.metadata === 'object') {
            const m = e.metadata as Record<string, unknown>;
            const total = typeof m.total === 'number' ? m.total : 0;
            bucket.totalRevenue += total;
            orderRevenueByKey.set(key, (orderRevenueByKey.get(key) ?? 0) + total);
          }
        }
        break;
    }
  }

  await prisma.dailyFunnelStats.deleteMany({ where: { date: dateCol } });

  const rows = Array.from(buckets.entries()).map(([key, bucket]) => {
    const [deviceType, trafficSource] = key.split('|');
    return {
      date: dateCol,
      deviceType,
      trafficSource,
      pageViews: bucket.pageViews,
      productViews: bucket.productViews,
      addToCartCount: bucket.addToCartCount,
      cartViews: bucket.cartViews,
      checkoutStarts: bucket.checkoutStarts,
      ordersCompleted: bucket.ordersCompleted,
      totalRevenue: bucket.totalRevenue,
      uniqueVisitors: bucket.uniqueSessions.size,
    };
  });

  if (rows.length > 0) {
    await prisma.dailyFunnelStats.createMany({ data: rows });
  }

  return {
    date: dayIso,
    rowsWritten: rows.length,
    totalEvents: events.length,
  };
}

/**
 * Aggregate yesterday's events. Intended for daily cron.
 */
export async function aggregateYesterday(): Promise<AggregateResult> {
  // Kyiv "yesterday", not UTC: anchor on today's Kyiv calendar date so a run
  // between 00:00 and 03:00 Kyiv still aggregates the correct day.
  const yesterday = new Date(`${todayKyivIso()}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return aggregateFunnelStats(yesterday);
}
