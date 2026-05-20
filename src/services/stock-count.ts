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

function generateReference(): string {
  const d = new Date();
  const prefix = `SC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${prefix}-${randomBytes(2).toString('hex').toUpperCase()}`;
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

export async function recordCount(countId: number, productId: number, countedQty: number) {
  const count = await prisma.stockCount.findUnique({ where: { id: countId } });
  if (!count) throw new StockCountError('Інвентаризацію не знайдено', 404);
  if (count.status !== 'in_progress') {
    throw new StockCountError('Інвентаризація вже закрита');
  }
  if (countedQty < 0) throw new StockCountError('Кількість не може бути від’ємною');

  const existing = await prisma.stockCountItem.findUnique({
    where: { countId_productId: { countId, productId } },
  });

  if (existing) {
    return prisma.stockCountItem.update({
      where: { id: existing.id },
      data: {
        countedQty,
        variance: countedQty - existing.expectedQty,
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
      countedQty,
      variance: countedQty,
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

    for (const item of count.items) {
      const counted = item.countedQty ?? 0;
      // Closing an inventory means the physical count is the new truth. Reset
      // `reserved` to 0 — leaving stale reservations behind would make the
      // displayed "available" turn negative for any product that had open
      // orders against it at the moment of the count.
      await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: count.warehouseId,
            productId: item.productId,
          },
        },
        update: { quantity: counted, reserved: 0 },
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
  const count = await prisma.stockCount.findUnique({ where: { id: countId } });
  if (!count) throw new StockCountError('Інвентаризацію не знайдено', 404);
  if (count.status !== 'in_progress') {
    throw new StockCountError('Можна скасувати лише активну інвентаризацію');
  }
  const result = await prisma.stockCount.update({
    where: { id: countId },
    data: { status: 'cancelled', completedAt: new Date() },
  });
  if (userId) {
    await logAudit({
      userId,
      actionType: 'data_update',
      entityType: 'stock_count',
      entityId: countId,
      details: { action: 'cancel' },
    });
  }
  return result;
}

export async function listStockCounts(filter?: { status?: string; offset?: number; limit?: number }) {
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
