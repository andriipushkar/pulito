import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  AddressError,
} from './delivery-address';

vi.mock('@/lib/prisma', () => {
  const userAddress = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  };
  const prisma = {
    userAddress,
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : undefined,
    ),
  };
  return { prisma };
});

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddressError', () => {
  it('should have correct message and statusCode', () => {
    const error = new AddressError('Адресу не знайдено', 404);
    expect(error.message).toBe('Адресу не знайдено');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('AddressError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('getUserAddresses', () => {
  it('should return addresses sorted by isDefault desc, createdAt desc', async () => {
    const mockAddresses = [
      { id: 1, userId: 1, city: 'Київ', isDefault: true },
      { id: 2, userId: 1, city: 'Львів', isDefault: false },
    ];
    mockPrisma.userAddress.findMany.mockResolvedValue(mockAddresses as never);

    const result = await getUserAddresses(1);

    expect(result).toEqual(mockAddresses);
    expect(mockPrisma.userAddress.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  });
});

describe('createAddress', () => {
  it('should create address without setting default', async () => {
    const data = { city: 'Київ', street: 'Хрещатик', building: '1' };
    const created = { id: 1, userId: 1, ...data, isDefault: false };
    mockPrisma.userAddress.create.mockResolvedValue(created as never);

    const result = await createAddress(1, data);

    expect(result).toEqual(created);
    expect(mockPrisma.userAddress.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.userAddress.create).toHaveBeenCalledWith({
      data: { userId: 1, ...data },
    });
  });

  it('should unset other defaults before creating default address', async () => {
    const data = { city: 'Львів', isDefault: true };
    const created = { id: 2, userId: 1, ...data };
    mockPrisma.userAddress.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.userAddress.create.mockResolvedValue(created as never);

    const result = await createAddress(1, data);

    expect(result).toEqual(created);
    expect(mockPrisma.userAddress.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isDefault: true },
      data: { isDefault: false },
    });
    expect(mockPrisma.userAddress.create).toHaveBeenCalledWith({
      data: { userId: 1, ...data },
    });
  });
});

describe('updateAddress', () => {
  it('should update address successfully', async () => {
    const existing = { id: 10, userId: 1, city: 'Київ', isDefault: false };
    const data = { city: 'Одеса' };
    const updated = { ...existing, ...data };
    mockPrisma.userAddress.findFirst.mockResolvedValue(existing as never);
    mockPrisma.userAddress.update.mockResolvedValue(updated as never);

    const result = await updateAddress(1, 10, data);

    expect(result).toEqual(updated);
    expect(mockPrisma.userAddress.findFirst).toHaveBeenCalledWith({
      where: { id: 10, userId: 1 },
    });
    expect(mockPrisma.userAddress.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data,
    });
  });

  it('should throw 404 when address not found', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(null);

    await expect(updateAddress(1, 999, { city: 'Одеса' })).rejects.toThrow(AddressError);
    await expect(updateAddress(1, 999, { city: 'Одеса' })).rejects.toThrow('Адресу не знайдено');
  });

  it('should unset other defaults when setting isDefault', async () => {
    const existing = { id: 10, userId: 1, city: 'Київ', isDefault: false };
    const data = { isDefault: true };
    mockPrisma.userAddress.findFirst.mockResolvedValue(existing as never);
    mockPrisma.userAddress.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.userAddress.update.mockResolvedValue({ ...existing, ...data } as never);

    await updateAddress(1, 10, data);

    expect(mockPrisma.userAddress.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isDefault: true, id: { not: 10 } },
      data: { isDefault: false },
    });
  });
});

describe('deleteAddress', () => {
  it('should delete address successfully', async () => {
    const existing = { id: 10, userId: 1, city: 'Київ' };
    mockPrisma.userAddress.findFirst.mockResolvedValue(existing as never);
    mockPrisma.userAddress.delete.mockResolvedValue(existing as never);

    await deleteAddress(1, 10);

    expect(mockPrisma.userAddress.findFirst).toHaveBeenCalledWith({
      where: { id: 10, userId: 1 },
    });
    expect(mockPrisma.userAddress.delete).toHaveBeenCalledWith({
      where: { id: 10 },
    });
  });

  it('should throw 404 when address not found', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(null);

    await expect(deleteAddress(1, 999)).rejects.toThrow(AddressError);
    await expect(deleteAddress(1, 999)).rejects.toThrow('Адресу не знайдено');
  });
});
