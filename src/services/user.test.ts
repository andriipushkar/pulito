import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllUsers, getUserById, updateUserRole, approveWholesale, rejectWholesale, UserError } from './user';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAllUsers', () => {
  it('should return paginated users with default params', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const result = await getAllUsers();
    expect(result).toEqual({ users: [], total: 0 });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });

  it('should filter by role', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ role: 'admin' });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: 'admin' }) })
    );
  });

  it('should filter by wholesaleStatus', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ wholesaleStatus: 'pending' });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ wholesaleStatus: 'pending' }) })
    );
  });

  it('should search by email, fullName, companyName, phone', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ search: 'test' });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { email: { contains: 'test', mode: 'insensitive' } },
            { fullName: { contains: 'test', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('should paginate correctly', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(50);

    const result = await getAllUsers({ page: 3, limit: 10 });
    expect(result.total).toBe(50);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

describe('getUserById', () => {
  it('should return user with extended fields', async () => {
    const mockUser = { id: 1, email: 'test@test.com', fullName: 'Test' };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser as never);

    const result = await getUserById(1);
    expect(result).toEqual(mockUser);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
  });

  it('should return null for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await getUserById(999);
    expect(result).toBeNull();
  });
});

describe('updateUserRole', () => {
  it('should update role for valid roles', async () => {
    const updated = { id: 1, role: 'manager' };
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'client' } as never);
    mockPrisma.user.update.mockResolvedValue(updated as never);

    const result = await updateUserRole(1, 'manager');
    expect(result).toEqual(updated);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { role: 'manager' },
      })
    );
  });

  it('should throw UserError for invalid role', async () => {
    await expect(updateUserRole(1, 'superadmin')).rejects.toThrow(UserError);
    await expect(updateUserRole(1, 'superadmin')).rejects.toThrow('Невалідна роль');
  });

  it('should accept all valid roles', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'client' } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    for (const role of ['client', 'wholesaler', 'manager', 'admin']) {
      await updateUserRole(1, role);
    }
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(4);
  });
});

describe('approveWholesale', () => {
  it('should approve pending wholesale request', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'pending' } as never);
    mockPrisma.user.update.mockResolvedValue({ id: 1, role: 'wholesaler', wholesaleStatus: 'approved' } as never);

    const result = await approveWholesale(1);
    expect(result).toEqual(expect.objectContaining({ wholesaleStatus: 'approved' }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'wholesaler',
          wholesaleStatus: 'approved',
        }),
      })
    );
  });

  it('should set manager if provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'pending' } as never);
    mockPrisma.user.update.mockResolvedValue({} as never);

    await approveWholesale(1, 5);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedManagerId: 5 }),
      })
    );
  });

  it('should throw 404 for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(approveWholesale(999)).rejects.toThrow('Користувача не знайдено');
  });

  it('should throw 400 if status is not pending', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'approved' } as never);
    await expect(approveWholesale(1)).rejects.toThrow('Запит не очікує розгляду');
  });
});

describe('rejectWholesale', () => {
  it('should reject pending wholesale request', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'pending' } as never);
    mockPrisma.user.update.mockResolvedValue({ wholesaleStatus: 'rejected' } as never);

    const result = await rejectWholesale(1);
    expect(result).toEqual(expect.objectContaining({ wholesaleStatus: 'rejected' }));
  });

  it('should throw 404 for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(rejectWholesale(999)).rejects.toThrow('Користувача не знайдено');
  });

  it('should throw 400 if status is not pending', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'rejected' } as never);
    await expect(rejectWholesale(1)).rejects.toThrow('Запит не очікує розгляду');
  });
});
