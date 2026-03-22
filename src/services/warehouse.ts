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
