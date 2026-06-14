import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { sumMoney, lineTotal, subtractMoney, round2 } from '@/utils/money';
import { kyivMidnightUtc, kyivNextDayUtc } from '@/utils/format';

export interface SupplierReconciliationRow {
  supplierId: number;
  supplierName: string;
  unitsSold: number;
  revenue: number; // what customers paid for these lines (sum of subtotals)
  cost: number; // what we owe the supplier (sum of supplierCostAtSale × qty)
  margin: number; // revenue − cost
  paid: number; // payouts recorded to this supplier within the range
  balance: number; // cost − paid (what's still owed for the period)
  outstanding: number; // ALL-TIME debt: every cost owed ever − every payout ever
}

export interface ReconciliationReport {
  from: string;
  to: string;
  rows: SupplierReconciliationRow[];
  totals: {
    unitsSold: number;
    revenue: number;
    cost: number;
    margin: number;
    paid: number;
    balance: number;
    outstanding: number;
  };
}

/**
 * Per-supplier money report over a Kyiv-local date range [from, to] (inclusive).
 * Sums every sold OrderItem that carries a supplierId, excluding cancelled
 * orders. `cost` is the snapshot taken at sale time (supplierCostAtSale), so the
 * "what we owe each supplier" figure is stable even if prices later moved.
 *
 * Aggregated in JS (not groupBy) because cost = Σ(cost × qty) isn't a column —
 * fine for a date-bounded window with a handful of suppliers.
 */
export async function getSupplierReconciliation(opts: {
  from: string; // YYYY-MM-DD (Kyiv)
  to: string; // YYYY-MM-DD (Kyiv)
  supplierId?: number;
}): Promise<ReconciliationReport> {
  const gte = kyivMidnightUtc(opts.from);
  const lt = kyivNextDayUtc(opts.to);

  const items = await prisma.orderItem.findMany({
    where: {
      supplierId: opts.supplierId != null ? opts.supplierId : { not: null },
      order: { status: { not: 'cancelled' }, createdAt: { gte, lt }, deletedAt: null },
    },
    select: { supplierId: true, quantity: true, subtotal: true, supplierCostAtSale: true },
  });

  // supplierId → accumulators (revenue/cost summed exactly via money utils).
  const acc = new Map<number, { unitsSold: number; revenues: number[]; costs: number[] }>();
  for (const it of items) {
    if (it.supplierId == null) continue;
    const bucket = acc.get(it.supplierId) ?? { unitsSold: 0, revenues: [], costs: [] };
    bucket.unitsSold += it.quantity;
    bucket.revenues.push(Number(it.subtotal));
    if (it.supplierCostAtSale != null) {
      bucket.costs.push(lineTotal(Number(it.supplierCostAtSale), it.quantity));
    }
    acc.set(it.supplierId, bucket);
  }

  const names = new Map<number, string>();
  if (acc.size > 0) {
    const suppliers = await prisma.supplierChannel.findMany({
      where: { id: { in: [...acc.keys()] } },
      select: { id: true, name: true },
    });
    for (const s of suppliers) names.set(s.id, s.name);
  }

  // Payouts recorded in the same window — the "paid" side of the period ledger.
  const paidBySupplier = new Map<number, number[]>();
  if (acc.size > 0) {
    const payouts = await prisma.supplierPayout.findMany({
      where: { supplierId: { in: [...acc.keys()] }, createdAt: { gte, lt } },
      select: { supplierId: true, amount: true },
    });
    for (const p of payouts) {
      const arr = paidBySupplier.get(p.supplierId) ?? [];
      arr.push(Number(p.amount));
      paidBySupplier.set(p.supplierId, arr);
    }
  }

  // ALL-TIME outstanding debt per supplier — independent of the report window so
  // a payout entered in a different period can't make "balance" lie. cost owed
  // ever (Σ cost×qty, raw SQL since it's not a column) − payouts ever.
  const outstandingBySupplier = new Map<number, number>();
  if (acc.size > 0) {
    const ids = [...acc.keys()];
    const costRows = await prisma.$queryRaw<
      { supplier_id: number; cost: bigint | number | string | null }[]
    >(
      Prisma.sql`
        SELECT oi.supplier_id, SUM(oi.supplier_cost_at_sale * oi.quantity) AS cost
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.supplier_id IN (${Prisma.join(ids)})
          AND oi.supplier_cost_at_sale IS NOT NULL
          AND o.status::text <> 'cancelled'
          AND o.deleted_at IS NULL
        GROUP BY oi.supplier_id
      `,
    );
    const paidAllTime = await prisma.supplierPayout.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: ids } },
      _sum: { amount: true },
    });
    const paidMap = new Map(paidAllTime.map((p) => [p.supplierId, Number(p._sum.amount ?? 0)]));
    for (const id of ids) {
      const costEver = round2(Number(costRows.find((r) => r.supplier_id === id)?.cost ?? 0));
      outstandingBySupplier.set(id, subtractMoney(costEver, paidMap.get(id) ?? 0));
    }
  }

  const rows: SupplierReconciliationRow[] = [...acc.entries()]
    .map(([supplierId, b]) => {
      const revenue = sumMoney(b.revenues);
      const cost = sumMoney(b.costs);
      const paid = sumMoney(paidBySupplier.get(supplierId) ?? []);
      return {
        supplierId,
        supplierName: names.get(supplierId) ?? `#${supplierId}`,
        unitsSold: b.unitsSold,
        revenue,
        cost,
        margin: subtractMoney(revenue, cost),
        paid,
        balance: subtractMoney(cost, paid),
        outstanding: outstandingBySupplier.get(supplierId) ?? subtractMoney(cost, paid),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    from: opts.from,
    to: opts.to,
    rows,
    totals: {
      unitsSold: rows.reduce((s, r) => s + r.unitsSold, 0),
      revenue: sumMoney(rows.map((r) => r.revenue)),
      cost: sumMoney(rows.map((r) => r.cost)),
      margin: sumMoney(rows.map((r) => r.margin)),
      paid: sumMoney(rows.map((r) => r.paid)),
      balance: sumMoney(rows.map((r) => r.balance)),
      outstanding: sumMoney(rows.map((r) => r.outstanding)),
    },
  };
}

/** Record a payout to a supplier (the ledger entry the report subtracts).
 *  Optional periodFrom/periodTo attribute the payment to the period it settles,
 *  so a late-entered payout is still traceable to the right month. */
export async function createSupplierPayout(input: {
  supplierId: number;
  amount: number;
  note?: string | null;
  createdBy?: number | null;
  periodFrom?: Date | null;
  periodTo?: Date | null;
}): Promise<{ id: number }> {
  const row = await prisma.supplierPayout.create({
    data: {
      supplierId: input.supplierId,
      amount: input.amount,
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
      periodFrom: input.periodFrom ?? null,
      periodTo: input.periodTo ?? null,
    },
    select: { id: true },
  });
  return row;
}
