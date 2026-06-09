import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

const METRIC_KEY_PREFIX = 'perf:';
const METRIC_TTL = 86400 * 2; // 2 days

export interface MetricEntry {
  route: string;
  metric: string; // LCP, CLS, FID, TTFB, INP
  value: number;
}

export async function recordMetric(entry: MetricEntry): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${METRIC_KEY_PREFIX}${today}:${entry.route}:${entry.metric}`;

  // Store as sorted set member with value as score for percentile calc
  await redis.zadd(key, entry.value, `${Date.now()}-${Math.random()}`);
  await redis.expire(key, METRIC_TTL);
}

export async function getAggregatedMetrics(dateFrom: string, dateTo: string, route?: string) {
  const where: {
    date: { gte: Date; lte: Date };
    route?: string;
  } = {
    // `date` is a @db.Date column (one row per calendar day at midnight), so a
    // plain date-string bound is correct here — no Kyiv-timezone shift needed.
    date: {
      gte: new Date(dateFrom),
      lte: new Date(dateTo),
    },
  };

  if (route) {
    where.route = route;
  }

  return prisma.performanceMetric.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

export async function aggregateDailyMetrics(dateStr: string): Promise<void> {
  const pattern = `${METRIC_KEY_PREFIX}${dateStr}:*`;
  const keys = await redis.keys(pattern);

  for (const key of keys) {
    // key format: perf:2024-01-15:/product:LCP
    const parts = key.replace(METRIC_KEY_PREFIX, '').split(':');
    if (parts.length < 3) continue;

    const date = parts[0];
    const route = parts.slice(1, -1).join(':');
    const metric = parts[parts.length - 1];

    // Get all values sorted
    const members = await redis.zrangebyscore(key, '-inf', '+inf', 'WITHSCORES');
    const values: number[] = [];
    for (let i = 1; i < members.length; i += 2) {
      values.push(parseFloat(members[i]));
    }
    values.sort((a, b) => a - b);

    if (values.length === 0) continue;

    const p50 = percentile(values, 50);
    const p75 = percentile(values, 75);
    const p90 = percentile(values, 90);

    await prisma.performanceMetric.upsert({
      where: {
        date_route_metric: {
          date: new Date(date),
          route,
          metric,
        },
      },
      update: {
        p50,
        p75,
        p90,
        sampleCount: values.length,
      },
      create: {
        date: new Date(date),
        route,
        metric,
        p50,
        p75,
        p90,
        sampleCount: values.length,
      },
    });
  }
}
