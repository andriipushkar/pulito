import { prisma } from '@/lib/prisma';

export class WarehouseError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'WarehouseError';
  }
}

export async function createWarehouse(data: {
  name: string;
  code: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}) {
  // Check unique code
  const existing = await prisma.warehouse.findUnique({ where: { code: data.code } });
  if (existing) {
    throw new WarehouseError('Склад з таким кодом вже існує', 409);
  }

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.warehouse.create({ data });
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
  }
) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) {
    throw new WarehouseError('Склад не знайдено', 404);
  }

  // Check unique code if changing
  if (data.code && data.code !== warehouse.code) {
    const existing = await prisma.warehouse.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new WarehouseError('Склад з таким кодом вже існує', 409);
    }
  }

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  return prisma.warehouse.update({ where: { id }, data });
}

export async function deleteWarehouse(id: number) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: { _count: { select: { stock: true } } },
  });

  if (!warehouse) {
    throw new WarehouseError('Склад не знайдено', 404);
  }

  if (warehouse._count.stock > 0) {
    throw new WarehouseError('Неможливо видалити склад з залишками товарів', 400);
  }

  return prisma.warehouse.delete({ where: { id } });
}

export async function getWarehouses() {
  return prisma.warehouse.findMany({
    include: { _count: { select: { stock: true } } },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
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
      },
    },
  });

  if (!warehouse) {
    throw new WarehouseError('Склад не знайдено', 404);
  }

  return warehouse;
}

export async function updateStock(
  warehouseId: number,
  items: { productId: number; quantity: number }[]
) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new WarehouseError('Склад не знайдено', 404);
  }

  const results = [];

  for (const item of items) {
    const result = await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId,
          productId: item.productId,
        },
      },
      update: { quantity: item.quantity },
      create: {
        warehouseId,
        productId: item.productId,
        quantity: item.quantity,
      },
    });
    results.push(result);
  }

  return results;
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
  items: { productId: number; quantity: number }[]
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
