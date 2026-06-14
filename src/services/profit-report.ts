import { prisma } from '@/lib/prisma';
import { sumMoney, lineTotal, subtractMoney, round2 } from '@/utils/money';
import { kyivMidnightUtc, kyivNextDayUtc } from '@/utils/format';

export interface ProfitRow {
  key: string;
  label: string;
  revenue: number; // sum of line subtotals (what customers paid for the goods)
  cogs: number; // cost of goods sold (cost × qty)
  profit: number; // revenue − cogs
  margin: number; // profit / revenue × 100 (one decimal)
  units: number;
  unknownCostUnits: number; // units with no known cost (margin understated for these)
}

export interface ProfitReport {
  from: string;
  to: string;
  totals: {
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
    units: number;
    orders: number;
    unknownCostUnits: number;
  };
  topProducts: ProfitRow[]; // most profitable
  lossProducts: ProfitRow[]; // negative-profit lines (priced below cost)
  byCategory: ProfitRow[];
  bySupplier: ProfitRow[];
}

interface Acc {
  label: string;
  revenues: number[];
  cogsList: number[];
  units: number;
  unknownCostUnits: number;
}

function bucket(map: Map<string, Acc>, key: string, label: string): Acc {
  let a = map.get(key);
  if (!a) {
    a = { label, revenues: [], cogsList: [], units: 0, unknownCostUnits: 0 };
    map.set(key, a);
  }
  return a;
}

function finalize(map: Map<string, Acc>): ProfitRow[] {
  return [...map.entries()].map(([key, a]) => {
    const revenue = sumMoney(a.revenues);
    const cogs = sumMoney(a.cogsList);
    const profit = subtractMoney(revenue, cogs);
    return {
      key,
      label: a.label,
      revenue,
      cogs,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      units: a.units,
      unknownCostUnits: a.unknownCostUnits,
    };
  });
}

/**
 * Profit (revenue − COGS) over a Kyiv-local date range, with breakdowns by
 * product, category and supplier. Cost per line prefers the sale-time snapshot
 * (OrderItem.supplierCostAtSale), falling back to the product's current `cost`;
 * lines with neither are counted in `unknownCostUnits` so the operator knows the
 * margin is understated there. Cancelled / deleted orders are excluded.
 *
 * Note: revenue is the sum of line subtotals (goods only). Order-level discounts
 * (coupon / loyalty / bundle) are NOT allocated per line, so real net revenue is
 * slightly lower — this is a goods-margin view, not a P&L.
 */
export async function getProfitReport(opts: { from: string; to: string }): Promise<ProfitReport> {
  const gte = kyivMidnightUtc(opts.from);
  const lt = kyivNextDayUtc(opts.to);

  const items = await prisma.orderItem.findMany({
    where: { order: { status: { not: 'cancelled' }, deletedAt: null, createdAt: { gte, lt } } },
    select: {
      orderId: true,
      productId: true,
      productCode: true,
      productName: true,
      quantity: true,
      subtotal: true,
      supplierCostAtSale: true,
      product: {
        select: {
          cost: true,
          categoryId: true,
          category: { select: { name: true } },
          supplierId: true,
        },
      },
    },
  });

  const totalsAcc = bucket(new Map(), '_', '_'); // standalone accumulator
  const byProduct = new Map<string, Acc>();
  const byCategory = new Map<string, Acc>();
  const bySupplier = new Map<string, Acc>();
  const supplierIds = new Set<number>();
  const orderIds = new Set<number>();

  for (const it of items) {
    orderIds.add(it.orderId);
    const revenue = Number(it.subtotal);
    const costUnit =
      it.supplierCostAtSale != null
        ? Number(it.supplierCostAtSale)
        : it.product?.cost != null
          ? Number(it.product.cost)
          : null;
    const cogs = costUnit != null ? lineTotal(costUnit, it.quantity) : 0;
    const unknown = costUnit == null ? it.quantity : 0;

    const push = (a: Acc) => {
      a.revenues.push(revenue);
      a.cogsList.push(cogs);
      a.units += it.quantity;
      a.unknownCostUnits += unknown;
    };

    push(totalsAcc);
    push(
      bucket(byProduct, it.productId ? `p${it.productId}` : `c:${it.productCode}`, it.productName),
    );

    const catName = it.product?.category?.name ?? 'Без категорії';
    push(
      bucket(
        byCategory,
        it.product?.categoryId ? `cat${it.product.categoryId}` : 'cat:none',
        catName,
      ),
    );

    const sid = it.product?.supplierId ?? null;
    if (sid != null) supplierIds.add(sid);
    push(
      bucket(
        bySupplier,
        sid != null ? `s${sid}` : 's:own',
        sid != null ? `#${sid}` : 'Власний товар',
      ),
    );
  }

  // Resolve supplier names for the bySupplier labels.
  if (supplierIds.size > 0) {
    const suppliers = await prisma.supplierChannel.findMany({
      where: { id: { in: [...supplierIds] } },
      select: { id: true, name: true },
    });
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    for (const s of suppliers) {
      const a = bySupplier.get(`s${s.id}`);
      if (a) a.label = names.get(s.id) ?? a.label;
    }
  }

  const products = finalize(byProduct);
  const revenue = sumMoney(totalsAcc.revenues);
  const cogs = sumMoney(totalsAcc.cogsList);
  const profit = subtractMoney(revenue, cogs);

  return {
    from: opts.from,
    to: opts.to,
    totals: {
      revenue,
      cogs,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      units: totalsAcc.units,
      orders: orderIds.size,
      unknownCostUnits: totalsAcc.unknownCostUnits,
    },
    topProducts: [...products].sort((a, b) => b.profit - a.profit).slice(0, 20),
    lossProducts: products
      .filter((p) => round2(p.profit) < 0)
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 20),
    byCategory: finalize(byCategory).sort((a, b) => b.profit - a.profit),
    bySupplier: finalize(bySupplier).sort((a, b) => b.profit - a.profit),
  };
}
