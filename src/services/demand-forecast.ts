import { prisma } from '@/lib/prisma';

/**
 * Demand forecasting — trailing-average reorder suggestions.
 *
 * Per product:
 *   1. Sum quantity sold in the last 90 days (orders not cancelled/returned)
 *   2. avgDailySales = sold / 90
 *   3. daysUntilOOS  = currentStock / avgDailySales   (Infinity when no recent sales)
 *   4. reorderQty    = ceil((leadTimeDays + bufferDays) * avgDailySales - currentStock)
 *
 * The model is intentionally simple. It captures the "what will run out and when"
 * question well enough to drive weekly supplier orders. Seasonality, promo lifts,
 * and trend detection are out of scope — owner reviews the list manually anyway.
 */

const TRAILING_WINDOW_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 14;
const DEFAULT_BUFFER_DAYS = 14;

export interface ForecastEntry {
  productId: number;
  name: string;
  code: string;
  currentStock: number;
  totalSold90d: number;
  avgDailySales: number;
  daysUntilOOS: number | null;
  reorderQty: number;
  urgency: 'critical' | 'soon' | 'ok' | 'over-stock' | 'no-sales';
}

interface ForecastOptions {
  leadTimeDays?: number;
  bufferDays?: number;
  limit?: number;
  /** Only include products with sales in the window. */
  movingOnly?: boolean;
}

export async function getDemandForecast(options: ForecastOptions = {}): Promise<ForecastEntry[]> {
  // Clamp inputs to sane positives. Negative leadTime/buffer flip the
  // `daysUntilOOS < leadTime` checks and mark healthy stock as "critical".
  // Limit=-1 would reach Prisma's `take` as -1 and throw on the query.
  const leadTime = Math.max(0, Math.floor(options.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS));
  const buffer = Math.max(0, Math.floor(options.bufferDays ?? DEFAULT_BUFFER_DAYS));
  const safeLimit = Math.max(1, Math.min(500, Math.floor(options.limit ?? 200)));
  const since = new Date(Date.now() - TRAILING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Aggregate sold quantities per product over the window
  const sold = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { not: null },
      order: {
        createdAt: { gte: since },
        status: { notIn: ['cancelled', 'returned'] },
        deletedAt: null,
      },
    },
    _sum: { quantity: true },
  });

  const soldByProduct = new Map<number, number>();
  for (const row of sold) {
    if (row.productId !== null) {
      soldByProduct.set(row.productId, row._sum.quantity ?? 0);
    }
  }

  // Fetch product info (limit to active products; opt-in to movingOnly filter)
  const productIds = Array.from(soldByProduct.keys());
  // Always exclude soft-deleted — reordering them silently puts archived
  // SKUs back into supplier orders.
  const productWhere = options.movingOnly
    ? { id: { in: productIds }, isActive: true, deletedAt: null }
    : { isActive: true, deletedAt: null };

  const products = await prisma.product.findMany({
    where: productWhere,
    select: {
      id: true,
      name: true,
      code: true,
      quantity: true,
    },
    take: safeLimit,
  });

  // Aggregate per-warehouse stock + reserved separately. Forecast uses
  // warehouse totals — Product.quantity drifts from the truth when WarehouseStock
  // is updated by transfers/inventory without propagating to Product.
  const stockAgg = await prisma.warehouseStock.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { quantity: true, reserved: true },
  });
  const stockByProduct = new Map<number, { quantity: number; reserved: number }>(
    stockAgg.map((r) => [
      r.productId,
      { quantity: r._sum.quantity ?? 0, reserved: r._sum.reserved ?? 0 },
    ]),
  );

  const entries: ForecastEntry[] = products.map((p) => {
    const sold90 = soldByProduct.get(p.id) ?? 0;
    const avgDaily = sold90 / TRAILING_WINDOW_DAYS;
    // Fall back to Product.quantity for products with no WarehouseStock row
    // (single-warehouse legacy data) so existing setups keep working.
    const stockRow = stockByProduct.get(p.id);
    const totalOnHand = stockRow ? stockRow.quantity : p.quantity;
    const totalReserved = stockRow ? stockRow.reserved : 0;
    const available = Math.max(0, totalOnHand - totalReserved);
    const daysUntilOOS = avgDaily > 0 ? available / avgDaily : null;
    const targetStock = (leadTime + buffer) * avgDaily;
    const reorderQty = Math.max(0, Math.ceil(targetStock - available));

    let urgency: ForecastEntry['urgency'];
    if (avgDaily === 0) {
      // No sales in the last 90 days; both branches end up as 'no-sales' but
      // keep the conditional so a future fork can distinguish "had stock, no
      // sales" from "no stock, no sales" without touching the type.
      urgency = 'no-sales';
    } else if (daysUntilOOS !== null && daysUntilOOS < leadTime) {
      urgency = 'critical';
    } else if (daysUntilOOS !== null && daysUntilOOS < leadTime + buffer) {
      urgency = 'soon';
    } else if (daysUntilOOS !== null && daysUntilOOS > 180) {
      urgency = 'over-stock';
    } else {
      urgency = 'ok';
    }

    return {
      productId: p.id,
      name: p.name,
      code: p.code,
      // Show the same `available` number that drives daysUntilOOS — earlier
      // shipped `Product.quantity` here which disagreed with the urgency
      // calc whenever WarehouseStock had drifted from the legacy field.
      currentStock: available,
      totalSold90d: sold90,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      daysUntilOOS: daysUntilOOS !== null ? Math.round(daysUntilOOS * 10) / 10 : null,
      reorderQty,
      urgency,
    };
  });

  // Sort: critical first, then soon, then ok, then over-stock, then no-sales.
  // Within each bucket: lowest daysUntilOOS first.
  const urgencyOrder: Record<ForecastEntry['urgency'], number> = {
    critical: 0,
    soon: 1,
    ok: 2,
    'over-stock': 3,
    'no-sales': 4,
  };
  entries.sort((a, b) => {
    const dr = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (dr !== 0) return dr;
    return (a.daysUntilOOS ?? Infinity) - (b.daysUntilOOS ?? Infinity);
  });

  return entries;
}
