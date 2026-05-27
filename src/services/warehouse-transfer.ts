import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { logAudit } from '@/services/audit';

export class WarehouseTransferError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'WarehouseTransferError';
  }
}

// Same advisory-lock namespace as `services/warehouse.ts updateStock`, so a
// transfer ship/receive serialises against direct admin stock edits on either
// warehouse — both sides claim the lock by warehouseId before mutating.
const WAREHOUSE_STOCK_LOCK_NS = 470001;

function generateReference(): string {
  const date = new Date();
  const prefix = `WT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  // 4 bytes (8 hex chars, ~4.3B combos) — earlier 2 bytes (65k combos)
  // would start colliding around 250+ transfers/day. Prisma still bubbles a
  // unique violation if luck runs out, but the per-day collision odds are
  // now small enough that the operator won't see the retry path.
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${suffix}`;
}

interface CreateInput {
  fromWarehouseId: number;
  toWarehouseId: number;
  items: { productId: number; quantity: number }[];
  comment?: string;
  createdBy: number;
}

export async function createTransfer(input: CreateInput) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new WarehouseTransferError('Склад відправника та одержувача мають відрізнятися');
  }
  if (input.items.length === 0) {
    throw new WarehouseTransferError('Додайте хоча б один товар');
  }
  for (const it of input.items) {
    if (it.quantity <= 0) {
      throw new WarehouseTransferError('Кількість має бути більше нуля');
    }
  }

  // Validate FKs up-front so the failure message tells the operator exactly
  // what's wrong instead of bubbling a raw Prisma "Foreign key constraint".
  const [fromWh, toWh] = await Promise.all([
    prisma.warehouse.findUnique({
      where: { id: input.fromWarehouseId },
      select: { id: true, isActive: true },
    }),
    prisma.warehouse.findUnique({
      where: { id: input.toWarehouseId },
      select: { id: true, isActive: true },
    }),
  ]);
  if (!fromWh || !fromWh.isActive) {
    throw new WarehouseTransferError('Склад-відправник не знайдено або деактивовано', 400);
  }
  if (!toWh || !toWh.isActive) {
    throw new WarehouseTransferError('Склад-одержувач не знайдено або деактивовано', 400);
  }
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const productCount = await prisma.product.count({
    where: { id: { in: productIds }, deletedAt: null },
  });
  if (productCount !== productIds.length) {
    throw new WarehouseTransferError('Деякі товари не існують або видалені', 400);
  }

  // Pre-flight stock check: warn operator at create-time if source
  // warehouse doesn't carry enough. Without this, admin happily fills a
  // draft, only to discover at ship-time that the totals don't match —
  // and the in-progress draft is now stuck until someone deletes/edits it.
  // We aggregate per productId because the input may carry duplicate rows.
  const requested = new Map<number, number>();
  for (const it of input.items) {
    requested.set(it.productId, (requested.get(it.productId) ?? 0) + it.quantity);
  }
  const sourceStock = await prisma.warehouseStock.findMany({
    where: { warehouseId: input.fromWarehouseId, productId: { in: productIds } },
    select: { productId: true, quantity: true, reserved: true },
  });
  const sourceByProduct = new Map(sourceStock.map((s) => [s.productId, s]));
  const shortages: { productId: number; need: number; have: number }[] = [];
  for (const [pid, need] of requested) {
    const row = sourceByProduct.get(pid);
    const available = row ? Math.max(0, row.quantity - row.reserved) : 0;
    if (available < need) shortages.push({ productId: pid, need, have: available });
  }
  if (shortages.length > 0) {
    const sample = shortages
      .slice(0, 5)
      .map((s) => `#${s.productId}: потрібно ${s.need}, доступно ${s.have}`)
      .join('; ');
    throw new WarehouseTransferError(
      `Недостатньо залишку на складі-відправнику: ${sample}${shortages.length > 5 ? '…' : ''}`,
      409,
    );
  }

  return prisma.warehouseTransfer.create({
    data: {
      reference: generateReference(),
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      comment: input.comment,
      createdBy: input.createdBy,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      },
    },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  });
}

export async function listTransfers(filter?: { status?: string; offset?: number; limit?: number }) {
  const limit = Math.min(filter?.limit ?? 50, 200);
  const offset = Math.max(filter?.offset ?? 0, 0);
  const where = filter?.status ? { status: filter.status as never } : undefined;

  const [items, total] = await Promise.all([
    prisma.warehouseTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: { select: { id: true, quantity: true } },
      },
    }),
    prisma.warehouseTransfer.count({ where }),
  ]);

  return { items, total, offset, limit };
}

export async function getTransfer(id: number) {
  const t = await prisma.warehouseTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  });
  if (!t) throw new WarehouseTransferError('Документ не знайдено', 404);
  return t;
}

/**
 * Mark transfer as shipped: decrement WarehouseStock at the source warehouse.
 * Runs inside a transaction so partial updates can't leak.
 */
export async function shipTransfer(id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.warehouseTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new WarehouseTransferError('Документ не знайдено', 404);
    if (transfer.status !== 'draft') {
      throw new WarehouseTransferError(
        `Не можна відвантажити документ зі статусу ${transfer.status}`,
      );
    }

    // Advisory lock on the source warehouse — concurrent admin stock edit
    // or order-fulfillment claim would otherwise race the decrement here.
    // Lock auto-releases when the transaction commits.
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${WAREHOUSE_STOCK_LOCK_NS}, $1::int)`,
      transfer.fromWarehouseId,
    );

    for (const item of transfer.items) {
      const stock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.fromWarehouseId,
            productId: item.productId,
          },
        },
      });
      if (!stock || stock.quantity < item.quantity) {
        throw new WarehouseTransferError(
          `Недостатньо залишку на складі-відправнику для товару #${item.productId}: потрібно ${item.quantity}, є ${stock?.quantity ?? 0}`,
        );
      }
      // While in transit the units are no longer on the source shelf but the
      // destination hasn't received them yet — park them in `reserved` so the
      // source warehouse still shows the commitment until receiveTransfer
      // moves it to the destination.
      await tx.warehouseStock.update({
        where: { id: stock.id },
        data: {
          quantity: { decrement: item.quantity },
          reserved: { increment: item.quantity },
        },
      });
    }

    await logAudit(
      {
        userId,
        actionType: 'data_update',
        entityType: 'warehouse_transfer',
        entityId: id,
        details: {
          action: 'ship',
          fromWarehouseId: transfer.fromWarehouseId,
          toWarehouseId: transfer.toWarehouseId,
          itemCount: transfer.items.length,
        },
      },
      tx,
    );

    return tx.warehouseTransfer.update({
      where: { id },
      data: {
        status: 'in_transit',
        shippedAt: new Date(),
        shippedBy: userId,
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
      },
    });
  });
}

/**
 * Mark transfer as received: increment WarehouseStock at the destination warehouse.
 */
export async function receiveTransfer(id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.warehouseTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new WarehouseTransferError('Документ не знайдено', 404);
    if (transfer.status !== 'in_transit') {
      throw new WarehouseTransferError(
        `Не можна оприбуткувати документ зі статусу ${transfer.status}`,
      );
    }

    // Lock BOTH warehouses (lowest id first to avoid deadlock with a
    // simultaneous receive in the opposite direction). Without this, a
    // concurrent stock edit on the destination could race the increment.
    const [loA, loB] = [transfer.fromWarehouseId, transfer.toWarehouseId].sort((a, b) => a - b);
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${WAREHOUSE_STOCK_LOCK_NS}, $1::int)`,
      loA,
    );
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${WAREHOUSE_STOCK_LOCK_NS}, $1::int)`,
      loB,
    );

    for (const item of transfer.items) {
      // Release the in-transit reservation at the source warehouse (paired
      // with the increment in shipTransfer). Clamp at 0 to be defensive
      // against pre-existing drift.
      const sourceStock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.fromWarehouseId,
            productId: item.productId,
          },
        },
        select: { id: true, reserved: true },
      });
      if (sourceStock) {
        await tx.warehouseStock.update({
          where: { id: sourceStock.id },
          data: { reserved: Math.max(0, sourceStock.reserved - item.quantity) },
        });
      }

      await tx.warehouseStock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.toWarehouseId,
            productId: item.productId,
          },
        },
        update: { quantity: { increment: item.quantity } },
        create: {
          warehouseId: transfer.toWarehouseId,
          productId: item.productId,
          quantity: item.quantity,
        },
      });
    }

    await logAudit(
      {
        userId,
        actionType: 'data_update',
        entityType: 'warehouse_transfer',
        entityId: id,
        details: {
          action: 'receive',
          fromWarehouseId: transfer.fromWarehouseId,
          toWarehouseId: transfer.toWarehouseId,
          itemCount: transfer.items.length,
        },
      },
      tx,
    );

    return tx.warehouseTransfer.update({
      where: { id },
      data: {
        status: 'completed',
        receivedAt: new Date(),
        receivedBy: userId,
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
      },
    });
  });
}

/**
 * Cancel an `in_transit` transfer: release the `reserved` units at the
 * source warehouse back into `quantity` (the goods never left, or the
 * paperwork was wrong). Refuses if status is anything other than
 * `in_transit` — for `draft` use `cancelTransfer`, for `completed` the
 * inventory already moved and only a reverse transfer can fix it.
 */
export async function cancelInTransitTransfer(id: number, reason: string, userId: number) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.warehouseTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) throw new WarehouseTransferError('Документ не знайдено', 404);
    if (transfer.status !== 'in_transit') {
      throw new WarehouseTransferError(
        `Скасувати in-transit можна тільки документ зі статусу in_transit (поточний: ${transfer.status})`,
        409,
      );
    }

    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${WAREHOUSE_STOCK_LOCK_NS}, $1::int)`,
      transfer.fromWarehouseId,
    );

    for (const item of transfer.items) {
      const stock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: transfer.fromWarehouseId,
            productId: item.productId,
          },
        },
      });
      if (!stock) continue;
      // Move the reserved units back into available quantity. Clamp the
      // reserved decrement at 0 in case of pre-existing drift.
      const releaseQty = Math.min(item.quantity, stock.reserved);
      await tx.warehouseStock.update({
        where: { id: stock.id },
        data: {
          quantity: { increment: releaseQty },
          reserved: { decrement: releaseQty },
        },
      });
    }

    await logAudit(
      {
        userId,
        actionType: 'data_update',
        entityType: 'warehouse_transfer',
        entityId: id,
        details: { action: 'cancel-in-transit', reason: reason || null },
      },
      tx,
    );

    return tx.warehouseTransfer.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledReason: reason || null,
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: { select: { id: true, name: true, code: true } } } },
      },
    });
  });
}

export async function cancelTransfer(id: number, reason: string, userId?: number) {
  // Atomic: updateMany with status='draft' guard. Without it, two concurrent cancels
  // could both pass the findUnique check before either commits, double-running side
  // effects (audit logs, downstream events).
  const updated = await prisma.warehouseTransfer.updateMany({
    where: { id, status: 'draft' },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason || null,
    },
  });
  if (updated.count === 0) {
    const transfer = await prisma.warehouseTransfer.findUnique({ where: { id } });
    if (!transfer) throw new WarehouseTransferError('Документ не знайдено', 404);
    throw new WarehouseTransferError(
      `Скасувати можна тільки чернетку (поточний статус: ${transfer.status})`,
    );
  }
  const result = await prisma.warehouseTransfer.findUniqueOrThrow({ where: { id } });
  if (userId) {
    await logAudit({
      userId,
      actionType: 'data_update',
      entityType: 'warehouse_transfer',
      entityId: id,
      details: { action: 'cancel', reason: reason || null },
    });
  }
  return result;
}
