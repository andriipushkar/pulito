import { prisma } from '@/lib/prisma';

export class WarehouseError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'WarehouseError';
  }
}

// pg_advisory_xact_lock namespace for warehouse stock updates. Per-warehouse
// lock serialises bulk PUT /stock vs. order-fulfillment writes so
// "read-100 / decrement-10" and "read-100 / set-50" can't lose the decrement.
// Namespace is arbitrary but stable; collisions across modules are avoided
// by using distinct namespace ints.
const WAREHOUSE_STOCK_LOCK_NS = 470001;

export async function createWarehouse(data: {
  name: string;
  code: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}) {
  // Run uniqueness check + default-flip + create inside one transaction so
  // two concurrent POSTs can't both pass the existence check and one end up
  // with a duplicate (catches the user-friendly error) while a parallel
  // isDefault flip leaves us with zero or two default warehouses.
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { code: data.code } });
      if (existing) {
        throw new WarehouseError('Склад з таким кодом вже існує', 409);
      }

      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.create({ data });
    });
  } catch (err) {
    // P2002: race on the unique index — rethrow as the same human error
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new WarehouseError('Склад з таким кодом вже існує', 409);
    }
    throw err;
  }
}

export async function updateWarehouse(
  id: number,
  data: {
    name?: string;
    code?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
  },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id } });
      if (!warehouse) {
        throw new WarehouseError('Склад не знайдено', 404);
      }

      if (data.code && data.code !== warehouse.code) {
        const existing = await tx.warehouse.findUnique({ where: { code: data.code } });
        if (existing) {
          throw new WarehouseError('Склад з таким кодом вже існує', 409);
        }
      }

      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({ where: { id }, data });
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new WarehouseError('Склад з таким кодом вже існує', 409);
    }
    throw err;
  }
}

export async function deleteWarehouse(id: number) {
  // Check + delete inside one transaction so an order can't race in and
  // create a WarehouseStock row between the `_count > 0` guard and the
  // cascade-delete (which would silently lose stock). The transaction
  // serialises stock-creating writes via Prisma's default isolation.
  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { stock: true } } },
    });

    if (!warehouse) {
      throw new WarehouseError('Склад не знайдено', 404);
    }
    if (warehouse.isDefault) {
      throw new WarehouseError(
        'Не можна видалити основний склад. Спочатку признач інший склад як основний.',
        400,
      );
    }
    if (warehouse._count.stock > 0) {
      throw new WarehouseError('Неможливо видалити склад з залишками товарів', 400);
    }
    return tx.warehouse.delete({ where: { id } });
  });
}

export async function getWarehouses() {
  const rows = await prisma.warehouse.findMany({
    include: { _count: { select: { stock: true } } },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  // Per-warehouse total on-hand quantity (sum of WarehouseStock.quantity).
  // The list previously showed `_count.stock` (number of SKU rows), which the
  // UI read as `stockCount` — so a warehouse with 100 SKUs at 0 qty looked
  // "stocked". Return BOTH: skuCount (rows) and stockCount (real units).
  const sums = await prisma.warehouseStock.groupBy({
    by: ['warehouseId'],
    _sum: { quantity: true },
  });
  const qtyByWh = new Map(sums.map((s) => [s.warehouseId, s._sum.quantity ?? 0]));
  return rows.map((wh) => ({
    ...wh,
    skuCount: wh._count.stock,
    stockCount: qtyByWh.get(wh.id) ?? 0,
  }));
}

export async function getWarehouseById(id: number) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      stock: {
        include: {
          product: { select: { id: true, name: true, code: true } },
        },
        orderBy: { updatedAt: 'desc' },
        // Bound the payload: an unbounded include would load every SKU row
        // (tens of thousands on a large catalog) into one response. The
        // dedicated paginated GET /warehouses/[id]/stock endpoint serves the
        // full, filterable list; this detail view shows the 500 most-recent.
        take: 500,
      },
    },
  });

  if (!warehouse) {
    throw new WarehouseError('Склад не знайдено', 404);
  }

  return warehouse;
}

export interface StockUpdateResult {
  updated: number;
  /** Pre-update quantities, keyed by productId — feed into audit details
   * so a rogue mass-edit leaves a recoverable trail. */
  before: Record<number, { quantity: number; reserved: number } | null>;
}

export async function updateStock(
  warehouseId: number,
  items: { productId: number; quantity: number }[],
): Promise<StockUpdateResult> {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new WarehouseError('Склад не знайдено', 404);
  }

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new WarehouseError(
        `Кількість має бути цілим невід'ємним числом (productId=${item.productId})`,
        400,
      );
    }
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const existing = await prisma.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  const missing = productIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new WarehouseError(`Товар не знайдено: ${missing.join(', ')}`, 404);
  }

  return prisma.$transaction(async (tx) => {
    // Per-warehouse advisory lock inside the transaction. Concurrent
    // order-fulfillment + manual stock-correction would otherwise both
    // read q=100, one decrement to 90, the other set to 50, and the
    // decrement is lost. Lock is released when the transaction commits.
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${WAREHOUSE_STOCK_LOCK_NS}, $1::int)`,
      warehouseId,
    );

    // Snapshot prior values so we can audit-log the before-state per row.
    // Concurrent stock writers are now blocked by the advisory lock, so
    // the read here matches what the upsert is about to overwrite.
    const prior = await tx.warehouseStock.findMany({
      where: { warehouseId, productId: { in: productIds } },
      select: { productId: true, quantity: true, reserved: true },
    });
    const before: Record<number, { quantity: number; reserved: number } | null> = {};
    for (const pid of productIds) before[pid] = null;
    for (const row of prior) {
      before[row.productId] = { quantity: row.quantity, reserved: row.reserved };
    }

    let updated = 0;
    for (const item of items) {
      // Refuse the update if it would drop quantity below reserved — the
      // CHECK constraint would reject it anyway, but a friendly error is
      // better than a raw Postgres violation surfacing as 500.
      const priorRow = before[item.productId];
      if (priorRow && item.quantity < priorRow.reserved) {
        throw new WarehouseError(
          `Кількість не може бути меншою за резерв (productId=${item.productId}, reserved=${priorRow.reserved})`,
          400,
        );
      }

      await tx.warehouseStock.upsert({
        where: { warehouseId_productId: { warehouseId, productId: item.productId } },
        update: { quantity: item.quantity },
        create: { warehouseId, productId: item.productId, quantity: item.quantity },
      });
      updated++;
    }

    return { updated, before };
  });
}

export async function getProductStock(productId: number) {
  return prisma.warehouseStock.findMany({
    where: { productId },
    include: {
      warehouse: { select: { id: true, name: true, code: true, city: true } },
    },
  });
}

export async function findNearestWarehouse(city: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { city: { equals: city, mode: 'insensitive' } },
    orderBy: { isDefault: 'desc' },
  });

  if (!warehouse) {
    // Fallback to default warehouse
    return prisma.warehouse.findFirst({
      where: { isDefault: true },
    });
  }

  return warehouse;
}

export async function getTotalStock(productId: number): Promise<number> {
  const result = await prisma.warehouseStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
}

/**
 * Auto-route order to the best warehouse based on delivery city and stock availability.
 * Returns the warehouse that can fulfill all items, preferring:
 * 1. Warehouse in the same city as delivery
 * 2. Default warehouse
 * 3. Any warehouse with sufficient stock
 */
export async function routeOrderToWarehouse(
  deliveryCity: string | null,
  items: { productId: number; quantity: number }[],
): Promise<{ warehouseId: number; warehouseName: string } | null> {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      stock: {
        where: { productId: { in: items.map((i) => i.productId) } },
      },
    },
    orderBy: [{ isDefault: 'desc' }],
  });

  if (warehouses.length === 0) return null;

  // Score each warehouse
  const scored = warehouses.map((wh) => {
    const stockMap = new Map(wh.stock.map((s) => [s.productId, s.quantity - s.reserved]));

    // Check if warehouse can fulfill all items
    const canFulfill = items.every((item) => (stockMap.get(item.productId) || 0) >= item.quantity);

    // City match bonus
    const cityMatch = deliveryCity && wh.city.toLowerCase() === deliveryCity.toLowerCase();

    return {
      warehouseId: wh.id,
      warehouseName: wh.name,
      canFulfill,
      score: (canFulfill ? 100 : 0) + (cityMatch ? 50 : 0) + (wh.isDefault ? 10 : 0),
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score === 0) return null;

  return { warehouseId: best.warehouseId, warehouseName: best.warehouseName };
}
