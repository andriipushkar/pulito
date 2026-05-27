import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { logAudit } from '@/services/audit';

export class StockCountError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'StockCountError';
  }
}

// Same advisory-lock namespace as services/warehouse.ts updateStock and
// services/warehouse-transfer.ts so close-inventory serialises against any
// other stock writer on the same warehouse. Without this the final upsert
// can stomp a concurrent order-fulfillment decrement.
const WAREHOUSE_STOCK_LOCK_NS = 470001;

function generateReference(): string {
  const d = new Date();
  const prefix = `SC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  // 4 bytes (~4.3B combos) — was 2 bytes (65k). At even 200 counts/day the
  // birthday-paradox collision odds with the old size become non-negligible
  // within a few months, surfacing as confusing P2002 errors.
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Start a stock count for a warehouse: snapshot current stock as expected qty
 * for every product that has a non-zero balance there. The counted_qty stays
 * null until the operator records a physical count.
 */
export async function startStockCount(warehouseId: number, userId: number, comment?: string) {
  // Verify warehouse exists + is active. Without this, a missing warehouse
  // surfaces as a raw foreign-key error from Prisma, not a friendly message.
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, isActive: true },
  });
  if (!warehouse) throw new StockCountError('Склад не знайдено', 404);
  if (!warehouse.isActive) throw new StockCountError('Склад деактивовано', 400);

  // Refuse a second concurrent count on the same warehouse. Two `in_progress`
  // records would each apply a separate `complete()` and the second would
  // overwrite the first's adjustments with stale expected values.
  const existing = await prisma.stockCount.findFirst({
    where: { warehouseId, status: 'in_progress' },
    select: { id: true, reference: true },
  });
  if (existing) {
    throw new StockCountError(
      `На цьому складі вже триває інвентаризація ${existing.reference}. Завершіть або скасуйте її перед стартом нової.`,
      409,
    );
  }

  // Skip soft-deleted products in the snapshot — they aren't visible in the
  // scan UI, so listing them as "missing" would just clutter the report.
  const stock = await prisma.warehouseStock.findMany({
    where: { warehouseId, product: { deletedAt: null } },
    select: { productId: true, quantity: true },
  });

  if (stock.length === 0) {
    throw new StockCountError('На складі немає товарів для інвентаризації');
  }

  const created = await prisma.stockCount.create({
    data: {
      reference: generateReference(),
      warehouseId,
      startedBy: userId,
      comment,
      items: {
        create: stock.map((s) => ({
          productId: s.productId,
          expectedQty: s.quantity,
        })),
      },
    },
    include: {
      warehouse: true,
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
      },
    },
  });

  await logAudit({
    userId,
    actionType: 'data_create',
    entityType: 'stock_count',
    entityId: created.id,
    details: { warehouseId, itemCount: stock.length },
  });

  return created;
}

/**
 * Record a counted quantity on a stock-count item.
 *
 * `mode = 'add'` (default, scanner workflow): each call ADDs to the current
 *   counted total. A bin with 50 items scanned one at a time ends up at 50,
 *   not 1. This is the correct default for a barcode workflow.
 *
 * `mode = 'set'` (manual UI): override the counted total. Used by the
 *   "I miscounted, the correct number is X" override field on the UI.
 *
 * Pre-fix behaviour was always SET — which silently undercounted any
 * product scanned more than once.
 */
export async function recordCount(
  countId: number,
  productId: number,
  qty: number,
  mode: 'add' | 'set' = 'add',
) {
  const count = await prisma.stockCount.findUnique({ where: { id: countId } });
  if (!count) throw new StockCountError('Інвентаризацію не знайдено', 404);
  if (count.status !== 'in_progress') {
    throw new StockCountError('Інвентаризація вже закрита');
  }
  if (qty < 0) throw new StockCountError('Кількість не може бути від’ємною');

  const existing = await prisma.stockCountItem.findUnique({
    where: { countId_productId: { countId, productId } },
  });

  if (existing) {
    const newCounted = mode === 'add' ? (existing.countedQty ?? 0) + qty : qty;
    return prisma.stockCountItem.update({
      where: { id: existing.id },
      data: {
        countedQty: newCounted,
        variance: newCounted - existing.expectedQty,
        countedAt: new Date(),
      },
    });
  }

  // Item was not in the snapshot (new arrival mid-count) — create row with expected=0
  return prisma.stockCountItem.create({
    data: {
      countId,
      productId,
      expectedQty: 0,
      countedQty: qty,
      variance: qty,
      countedAt: new Date(),
    },
  });
}

/**
 * Close the inventory and apply counted quantities as the new WarehouseStock.
 * Items with `countedQty == null` are treated as zero (operator did not find them).
 */
export async function completeStockCount(countId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.findUnique({
      where: { id: countId },
      include: { items: true },
    });
    if (!count) throw new StockCountError('Інвентаризацію не знайдено', 404);
    if (count.status !== 'in_progress') {
      throw new StockCountError('Інвентаризація вже закрита');
    }

    // Advisory lock the warehouse before mutating stock so a concurrent
    // order-fulfillment / manual stock edit can't lose a write here.
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${WAREHOUSE_STOCK_LOCK_NS}, $1::int)`,
      count.warehouseId,
    );

    // Snapshot existing rows so we preserve `reserved` (commitments to live
    // orders). Pre-fix code reset reserved to 0, which freed already-promised
    // units back into available stock and let the next order oversell.
    const existingStock = await tx.warehouseStock.findMany({
      where: {
        warehouseId: count.warehouseId,
        productId: { in: count.items.map((i) => i.productId) },
      },
      select: { productId: true, reserved: true },
    });
    const reservedByProduct = new Map(existingStock.map((s) => [s.productId, s.reserved]));

    for (const item of count.items) {
      const counted = item.countedQty ?? 0;
      const reservedNow = reservedByProduct.get(item.productId) ?? 0;
      // Honour the CHECK constraint `reserved <= quantity`: if the physical
      // count came in below currently-reserved (a pending order can't be
      // fulfilled), clamp reserved to the new ceiling. The over-promised
      // orders will surface as fulfillment errors downstream — the right
      // place to deal with them, not silently inside the inventory close.
      const reservedAfter = Math.min(reservedNow, counted);
      await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: count.warehouseId,
            productId: item.productId,
          },
        },
        update: { quantity: counted, reserved: reservedAfter },
        create: {
          warehouseId: count.warehouseId,
          productId: item.productId,
          quantity: counted,
        },
      });

      // Persist final variance for items the operator skipped
      if (item.countedQty === null) {
        await tx.stockCountItem.update({
          where: { id: item.id },
          data: {
            countedQty: 0,
            variance: -item.expectedQty,
            countedAt: new Date(),
          },
        });
      }
    }

    const result = await tx.stockCount.update({
      where: { id: countId },
      data: {
        status: 'completed',
        completedBy: userId,
        completedAt: new Date(),
      },
      include: {
        warehouse: true,
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
      },
    });

    const totalVariance = count.items.reduce(
      (sum, i) => sum + ((i.countedQty ?? 0) - i.expectedQty),
      0,
    );
    await logAudit(
      {
        userId,
        actionType: 'data_update',
        entityType: 'stock_count',
        entityId: countId,
        details: {
          action: 'complete',
          warehouseId: count.warehouseId,
          itemCount: count.items.length,
          totalVariance,
        },
      },
      tx,
    );

    return result;
  });
}

export async function cancelStockCount(countId: number, userId?: number) {
  // Atomic guard: prevents double-cancel race when two operators click cancel
  // at the same time. The `status: 'in_progress'` filter in updateMany rejects
  // the second request without throwing on the conflict.
  const updated = await prisma.stockCount.updateMany({
    where: { id: countId, status: 'in_progress' },
    data: { status: 'cancelled', completedAt: new Date() },
  });
  if (updated.count === 0) {
    const count = await prisma.stockCount.findUnique({ where: { id: countId } });
    if (!count) throw new StockCountError('Інвентаризацію не знайдено', 404);
    throw new StockCountError('Можна скасувати лише активну інвентаризацію');
  }
  const result = await prisma.stockCount.findUniqueOrThrow({ where: { id: countId } });
  if (userId) {
    await logAudit({
      userId,
      actionType: 'data_update',
      entityType: 'stock_count',
      entityId: countId,
      details: { action: 'cancel' },
    }).catch(() => {
      /* audit failure must not undo cancel */
    });
  }
  return result;
}

export async function listStockCounts(filter?: {
  status?: string;
  offset?: number;
  limit?: number;
}) {
  const limit = Math.min(filter?.limit ?? 50, 200);
  const offset = Math.max(filter?.offset ?? 0, 0);
  const where = filter?.status ? { status: filter.status as never } : undefined;

  const [items, total] = await Promise.all([
    prisma.stockCount.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: { select: { id: true, countedQty: true } },
      },
    }),
    prisma.stockCount.count({ where }),
  ]);

  return { items, total, offset, limit };
}

export async function getStockCount(id: number) {
  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      warehouse: true,
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { product: { name: 'asc' } },
      },
    },
  });
  if (!count) throw new StockCountError('Не знайдено', 404);
  return count;
}
