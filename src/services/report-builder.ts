import { prisma } from '@/lib/prisma';

/**
 * Sandboxed report builder. Whitelists dimensions/metrics so the UI can't construct
 * arbitrary SQL. Aggregates orders into a grouped result. For a small shop this is
 * enough — no need for star-schema modeling.
 */

export type Dimension = 'status' | 'clientType' | 'deliveryMethod' | 'paymentMethod' | 'monthYear';
export type Metric = 'orderCount' | 'totalRevenue' | 'avgCheck';

export interface ReportInput {
  dimension: Dimension;
  metrics: Metric[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportRow {
  dimension: string;
  orderCount?: number;
  totalRevenue?: number;
  avgCheck?: number;
}

export async function runReport(input: ReportInput): Promise<ReportRow[]> {
  const where: Record<string, unknown> = {};
  if (input.dateFrom) {
    (where as Record<string, { gte?: Date; lt?: Date }>).createdAt = {
      ...((where as { createdAt?: { gte?: Date; lt?: Date } }).createdAt || {}),
      gte: new Date(input.dateFrom),
    };
  }
  if (input.dateTo) {
    const end = new Date(input.dateTo);
    end.setUTCDate(end.getUTCDate() + 1);
    (where as Record<string, { gte?: Date; lt?: Date }>).createdAt = {
      ...((where as { createdAt?: { gte?: Date; lt?: Date } }).createdAt || {}),
      lt: end,
    };
  }

  // For category-style dimensions we use Prisma's groupBy. For monthYear we
  // collect raw rows and bucket in JS — groupBy on a derived column would need
  // raw SQL and the loss of type safety isn't worth the perf gain on a small
  // dataset.
  if (input.dimension === 'monthYear') {
    const rows = await prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true, status: true },
    });
    const buckets = new Map<string, { count: number; sum: number }>();
    for (const r of rows) {
      if (r.status === 'cancelled' || r.status === 'returned') continue;
      const key = `${r.createdAt.getUTCFullYear()}-${String(r.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const b = buckets.get(key) ?? { count: 0, sum: 0 };
      b.count += 1;
      b.sum += Number(r.totalAmount);
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dim, b]) => buildRow(input.metrics, dim, b.count, b.sum));
  }

  const fieldMap: Record<Exclude<Dimension, 'monthYear'>, 'status' | 'clientType' | 'deliveryMethod' | 'paymentMethod'> = {
    status: 'status',
    clientType: 'clientType',
    deliveryMethod: 'deliveryMethod',
    paymentMethod: 'paymentMethod',
  };
  const field = fieldMap[input.dimension];

  const grouped = await prisma.order.groupBy({
    by: [field],
    where,
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  return grouped.map((g) => {
    const dim = (g as Record<string, unknown>)[field];
    const dimStr = dim === null || dim === undefined ? '(пусто)' : String(dim);
    return buildRow(input.metrics, dimStr, g._count._all, Number(g._sum.totalAmount ?? 0));
  });
}

function buildRow(metrics: Metric[], dimension: string, count: number, sum: number): ReportRow {
  const row: ReportRow = { dimension };
  if (metrics.includes('orderCount')) row.orderCount = count;
  if (metrics.includes('totalRevenue')) row.totalRevenue = sum;
  if (metrics.includes('avgCheck')) row.avgCheck = count > 0 ? sum / count : 0;
  return row;
}
