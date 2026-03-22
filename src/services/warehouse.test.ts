import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWarehouseFindUnique = vi.fn();
const mockWarehouseCreate = vi.fn();
const mockWarehouseDelete = vi.fn();
const mockWarehouseUpdateMany = vi.fn();
const mockWarehouseFindFirst = vi.fn();
const mockStockUpsert = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    warehouse: {
      findUnique: (...args: unknown[]) => mockWarehouseFindUnique(...args),
      create: (...args: unknown[]) => mockWarehouseCreate(...args),
      delete: (...args: unknown[]) => mockWarehouseDelete(...args),
      updateMany: (...args: unknown[]) => mockWarehouseUpdateMany(...args),
      findFirst: (...args: unknown[]) => mockWarehouseFindFirst(...args),
    },
    warehouseStock: {
      upsert: (...args: unknown[]) => mockStockUpsert(...args),
    },
  },
}));

import {
  createWarehouse,
  deleteWarehouse,
  updateStock,
  findNearestWarehouse,
} from './warehouse';

beforeEach(() => vi.clearAllMocks());

describe('createWarehouse', () => {
  it('creates a warehouse', async () => {
    mockWarehouseFindUnique.mockResolvedValue(null); // no code conflict
    const created = { id: 1, name: 'Main', code: 'WH-01' };
    mockWarehouseCreate.mockResolvedValue(created);

    const result = await createWarehouse({ name: 'Main', code: 'WH-01', city: 'Kyiv' });

    expect(result).toEqual(created);
    expect(mockWarehouseCreate).toHaveBeenCalled();
  });

  it('throws on duplicate code', async () => {
    mockWarehouseFindUnique.mockResolvedValue({ id: 99 });

    await expect(
      createWarehouse({ name: 'Dup', code: 'WH-01', city: 'Kyiv' })
    ).rejects.toThrow();
  });

  it('unsets other defaults when creating as default', async () => {
    mockWarehouseFindUnique.mockResolvedValue(null);
    mockWarehouseUpdateMany.mockResolvedValue({ count: 1 });
    mockWarehouseCreate.mockResolvedValue({ id: 2, isDefault: true });

    await createWarehouse({ name: 'New Default', code: 'WH-02', city: 'Lviv', isDefault: true });

    expect(mockWarehouseUpdateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  });
});

describe('deleteWarehouse', () => {
  it('deletes warehouse with no stock', async () => {
    mockWarehouseFindUnique.mockResolvedValue({ id: 1, _count: { stock: 0 } });
    mockWarehouseDelete.mockResolvedValue(undefined);

    await deleteWarehouse(1);

    expect(mockWarehouseDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('blocks deletion if stock exists', async () => {
    mockWarehouseFindUnique.mockResolvedValue({ id: 1, _count: { stock: 5 } });

    await expect(deleteWarehouse(1)).rejects.toThrow();
    expect(mockWarehouseDelete).not.toHaveBeenCalled();
  });

  it('throws when warehouse not found', async () => {
    mockWarehouseFindUnique.mockResolvedValue(null);

    await expect(deleteWarehouse(999)).rejects.toThrow();
  });
});

describe('updateStock', () => {
  it('upserts stock items for warehouse', async () => {
    mockWarehouseFindUnique.mockResolvedValue({ id: 1 });
    mockStockUpsert.mockResolvedValue({ warehouseId: 1, productId: 10, quantity: 50 });

    const result = await updateStock(1, [{ productId: 10, quantity: 50 }]);

    expect(result).toHaveLength(1);
    expect(mockStockUpsert).toHaveBeenCalledWith({
      where: { warehouseId_productId: { warehouseId: 1, productId: 10 } },
      update: { quantity: 50 },
      create: { warehouseId: 1, productId: 10, quantity: 50 },
    });
  });

  it('throws when warehouse not found', async () => {
    mockWarehouseFindUnique.mockResolvedValue(null);

    await expect(updateStock(999, [{ productId: 1, quantity: 1 }])).rejects.toThrow();
  });
});

describe('findNearestWarehouse', () => {
  it('returns warehouse in the same city', async () => {
    const warehouse = { id: 1, city: 'Kyiv' };
    mockWarehouseFindFirst.mockResolvedValue(warehouse);

    const result = await findNearestWarehouse('Kyiv');

    expect(result).toEqual(warehouse);
    expect(mockWarehouseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { city: { equals: 'Kyiv', mode: 'insensitive' } },
      })
    );
  });

  it('falls back to default warehouse when city not found', async () => {
    const defaultWh = { id: 2, city: 'Kyiv', isDefault: true };
    mockWarehouseFindFirst
      .mockResolvedValueOnce(null) // no city match
      .mockResolvedValueOnce(defaultWh); // default fallback

    const result = await findNearestWarehouse('Uzhhorod');

    expect(result).toEqual(defaultWh);
    expect(mockWarehouseFindFirst).toHaveBeenCalledTimes(2);
  });
});
