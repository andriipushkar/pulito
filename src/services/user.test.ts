import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    DATABASE_URL: 'postgres://test',
    JWT_SECRET: 'a]3Kf9$mPz!wQr7vLx2NhBt5YdCjEu8G',
    APP_SECRET: 'b]3Kf9$mPz!wQr7vLx2NhBt5YdCjEu8G',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
    wishlistItem: {
      findMany: vi.fn(),
    },
    recentlyViewed: {
      findMany: vi.fn(),
    },
    userAddress: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    cartItem: {
      deleteMany: vi.fn(),
    },
    wishlist: {
      deleteMany: vi.fn(),
    },
    searchHistory: {
      deleteMany: vi.fn(),
    },
    userNotification: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
}));

vi.mock('@/services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/telegram', () => ({
  sendClientNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/viber', () => ({
  sendViberNotification: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import {
  UserError,
  getAllUsers,
  getUserById,
  updateUserProfile,
  toggleBlockUser,
  getUserOrders,
  resetUserPassword,
  updateAdminNote,
  getUserStats,
  getUserAuditLog,
  verifyUserEmail,
  sendMessageToUser,
  getUserWishlist,
  getUserRecentlyViewed,
  getUserAddresses,
  exportUserData,
  deleteUserAccount,
  updateUserRole,
  approveWholesale,
  rejectWholesale,
} from './user';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserError', () => {
  it('creates error with message and statusCode', () => {
    const err = new UserError('test', 404);
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('UserError');
  });

  it('defaults statusCode to 400', () => {
    const err = new UserError('bad');
    expect(err.statusCode).toBe(400);
  });
});

describe('getAllUsers', () => {
  it('returns paginated users with defaults', async () => {
    const users = [{ id: 1 }];
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await getAllUsers();

    expect(result).toEqual({ users, total: 1 });
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('applies role filter', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ role: 'admin' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ role: 'admin' }) }),
    );
  });

  it('applies wholesaleStatus and wholesaleGroup filters', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ wholesaleStatus: 'approved', wholesaleGroup: '2' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ wholesaleStatus: 'approved', wholesaleGroup: 2 }),
      }),
    );
  });

  it('applies search filter with OR conditions', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ search: 'john' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { email: { contains: 'john', mode: 'insensitive' } },
            { fullName: { contains: 'john', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });

  it('applies date range filters', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ dateFrom: '2024-01-01', dateTo: '2024-12-31' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('sorts by fullName', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ sortBy: 'fullName', sortOrder: 'asc' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { fullName: 'asc' } }),
    );
  });

  it('sorts by orders count', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ sortBy: 'orders', sortOrder: 'desc' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { orders: { _count: 'desc' } } }),
    );
  });

  it('paginates correctly', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await getAllUsers({ page: 3, limit: 10 });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

describe('getUserById', () => {
  it('returns user with detail select', async () => {
    const user = { id: 1, email: 'a@b.com' };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const result = await getUserById(1);

    expect(result).toEqual(user);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
  });

  it('returns null for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await getUserById(999);
    expect(result).toBeNull();
  });
});

describe('updateUserProfile', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(updateUserProfile(999, { fullName: 'New' }, 1)).rejects.toThrow(UserError);
    await expect(updateUserProfile(999, { fullName: 'New' }, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if email is taken', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, email: 'old@test.com' })
      .mockResolvedValueOnce({ id: 2, email: 'new@test.com' });

    await expect(updateUserProfile(1, { email: 'new@test.com' }, 10)).rejects.toThrow(UserError);
  });

  it('updates profile and creates audit log', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1, email: 'a@b.com' });
    const updated = { id: 1, fullName: 'Updated' };
    mockPrisma.user.update.mockResolvedValue(updated);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await updateUserProfile(1, { fullName: 'Updated' }, 10);

    expect(result).toEqual(updated);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 10, actionType: 'user_edit', entityId: 1 }),
      }),
    );
  });

  it('allows same email without uniqueness check', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 1, email: 'same@test.com' });
    mockPrisma.user.update.mockResolvedValue({ id: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await expect(updateUserProfile(1, { email: 'same@test.com' }, 10)).resolves.toBeDefined();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('toggleBlockUser', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(toggleBlockUser(999, true, undefined, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('blocks user, deletes refresh tokens, creates audit log', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, isBlocked: false });
    mockPrisma.user.update.mockResolvedValue({ id: 1, isBlocked: true });
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await toggleBlockUser(1, true, 'spam', 10);

    expect(result).toEqual({ id: 1, isBlocked: true });
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'user_block' }),
      }),
    );
  });

  it('unblocks user without deleting tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, isBlocked: true });
    mockPrisma.user.update.mockResolvedValue({ id: 1, isBlocked: false });
    mockPrisma.auditLog.create.mockResolvedValue({});

    await toggleBlockUser(1, false, undefined, 10);

    expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'user_unblock' }),
      }),
    );
  });
});

describe('getUserOrders', () => {
  it('returns user orders with default limit', async () => {
    const orders = [{ id: 1, orderNumber: 'ORD-001' }];
    mockPrisma.order.findMany.mockResolvedValue(orders);

    const result = await getUserOrders(1);

    expect(result).toEqual(orders);
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 }, take: 10 }),
    );
  });

  it('accepts custom limit', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    await getUserOrders(1, 5);
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });
});

describe('resetUserPassword', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(resetUserPassword(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('resets password, invalidates sessions, returns temp password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'user@test.com' });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await resetUserPassword(1, 10);

    expect(result.tempPassword).toBeDefined();
    expect(result.tempPassword).toHaveLength(8);
    expect(result.email).toBe('user@test.com');
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'password_reset' }),
      }),
    );
  });
});

describe('updateAdminNote', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(updateAdminNote(999, 'note')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates admin note', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    const updated = { id: 1, adminNote: 'VIP client' };
    mockPrisma.user.update.mockResolvedValue(updated);

    const result = await updateAdminNote(1, 'VIP client');

    expect(result).toEqual(updated);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { adminNote: 'VIP client' } }),
    );
  });

  it('sets null when note is empty', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.user.update.mockResolvedValue({ id: 1, adminNote: null });

    await updateAdminNote(1, '');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { adminNote: null } }),
    );
  });
});

describe('getUserStats', () => {
  it('returns computed stats', async () => {
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 5000 }, _count: 5 });
    mockPrisma.order.findFirst.mockResolvedValue({ createdAt: new Date('2024-06-01') });
    mockPrisma.order.count.mockResolvedValue(7);

    const result = await getUserStats(1);

    expect(result).toEqual({
      totalOrders: 7,
      completedOrders: 5,
      totalPurchases: 5000,
      avgCheck: 1000,
      lastOrderDate: expect.any(Date),
    });
  });

  it('handles zero orders', async () => {
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: null }, _count: 0 });
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.order.count.mockResolvedValue(0);

    const result = await getUserStats(1);

    expect(result).toEqual({
      totalOrders: 0,
      completedOrders: 0,
      totalPurchases: 0,
      avgCheck: 0,
      lastOrderDate: null,
    });
  });
});

describe('getUserAuditLog', () => {
  it('returns audit logs for user', async () => {
    const logs = [{ id: 1, actionType: 'user_edit' }];
    mockPrisma.auditLog.findMany.mockResolvedValue(logs);

    const result = await getUserAuditLog(1);

    expect(result).toEqual(logs);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ userId: 1 }, { entityType: 'user', entityId: 1 }] },
        take: 20,
      }),
    );
  });
});

describe('verifyUserEmail', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(verifyUserEmail(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if already verified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, isVerified: true });
    await expect(verifyUserEmail(1, 10)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('verifies email and creates audit log', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, isVerified: false });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await verifyUserEmail(1, 10);

    expect(result).toEqual({ success: true });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { isVerified: true } }),
    );
  });
});

describe('sendMessageToUser', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(sendMessageToUser(999, 'hi', ['email'])).rejects.toMatchObject({ statusCode: 404 });
  });

  it('sends email successfully', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1, email: 'a@b.com', fullName: 'John', telegramChatId: null, viberUserId: null,
    });

    const result = await sendMessageToUser(1, 'Hello', ['email']);

    expect(result).toEqual({ sent: ['email'] });
  });

  it('sends telegram when user has chatId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1, email: 'a@b.com', fullName: 'John', telegramChatId: '123', viberUserId: null,
    });

    const result = await sendMessageToUser(1, 'Hello', ['telegram']);

    expect(result).toEqual({ sent: ['telegram'] });
  });

  it('throws if no channel succeeds', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1, email: 'a@b.com', fullName: 'John', telegramChatId: null, viberUserId: null,
    });

    await expect(sendMessageToUser(1, 'Hello', ['telegram'])).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('getUserWishlist', () => {
  it('maps wishlist items correctly', async () => {
    mockPrisma.wishlistItem.findMany.mockResolvedValue([
      {
        id: 1,
        addedAt: new Date('2024-01-01'),
        product: { id: 10, name: 'Soap', slug: 'soap', priceRetail: 150, quantity: 5, isActive: true, imagePath: '/img.jpg' },
      },
    ]);

    const result = await getUserWishlist(1);

    expect(result).toEqual([
      {
        id: 1,
        createdAt: expect.any(Date),
        product: { id: 10, name: 'Soap', slug: 'soap', price: 150, imageUrl: '/img.jpg', inStock: true },
      },
    ]);
  });

  it('marks out of stock correctly', async () => {
    mockPrisma.wishlistItem.findMany.mockResolvedValue([
      {
        id: 1,
        addedAt: new Date(),
        product: { id: 10, name: 'X', slug: 'x', priceRetail: 100, quantity: 0, isActive: true, imagePath: null },
      },
    ]);

    const result = await getUserWishlist(1);
    expect(result[0].product.inStock).toBe(false);
  });
});

describe('getUserRecentlyViewed', () => {
  it('maps recently viewed items', async () => {
    mockPrisma.recentlyViewed.findMany.mockResolvedValue([
      {
        id: 1,
        viewedAt: new Date('2024-06-01'),
        product: { id: 5, name: 'Detergent', slug: 'detergent', priceRetail: 200, imagePath: '/d.jpg' },
      },
    ]);

    const result = await getUserRecentlyViewed(1);

    expect(result).toEqual([
      {
        id: 1,
        viewedAt: expect.any(Date),
        product: { id: 5, name: 'Detergent', slug: 'detergent', price: 200, imageUrl: '/d.jpg' },
      },
    ]);
  });
});

describe('getUserAddresses', () => {
  it('returns addresses sorted by default then date', async () => {
    const addresses = [{ id: 1 }];
    mockPrisma.userAddress.findMany.mockResolvedValue(addresses);

    const result = await getUserAddresses(1);

    expect(result).toEqual(addresses);
    expect(mockPrisma.userAddress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  });
});

describe('exportUserData', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(exportUserData(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns full user data', async () => {
    const userData = { id: 1, email: 'a@b.com', orders: [], addresses: [], wishlists: [] };
    mockPrisma.user.findUnique.mockResolvedValue(userData);

    const result = await exportUserData(1);
    expect(result).toEqual(userData);
  });
});

describe('deleteUserAccount', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(deleteUserAccount(999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 if user is admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com', role: 'admin' });
    await expect(deleteUserAccount(1, 10)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('deletes user with transaction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com', role: 'client' });
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: { updateMany: vi.fn() },
        cartItem: { deleteMany: vi.fn() },
        wishlist: { deleteMany: vi.fn() },
        recentlyViewed: { deleteMany: vi.fn() },
        userAddress: { deleteMany: vi.fn() },
        refreshToken: { deleteMany: vi.fn() },
        searchHistory: { deleteMany: vi.fn() },
        userNotification: { deleteMany: vi.fn() },
        auditLog: { create: vi.fn() },
        user: { delete: vi.fn() },
      };
      await cb(tx);
    });

    const result = await deleteUserAccount(1, 10);

    expect(result).toEqual({ success: true });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('updateUserRole', () => {
  it('throws on invalid role', async () => {
    await expect(updateUserRole(1, 'superadmin')).rejects.toThrow(UserError);
    await expect(updateUserRole(1, 'superadmin')).rejects.toThrow('Невалідна роль');
  });

  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(updateUserRole(1, 'admin')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates role and creates audit log when adminId provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'client' });
    const updated = { id: 1, role: 'manager' };
    mockPrisma.user.update.mockResolvedValue(updated);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await updateUserRole(1, 'manager', 10);

    expect(result).toEqual(updated);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'role_change',
          details: { oldRole: 'client', newRole: 'manager' },
        }),
      }),
    );
  });

  it('skips audit log when no adminId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'client' });
    mockPrisma.user.update.mockResolvedValue({ id: 1, role: 'admin' });

    await updateUserRole(1, 'admin');

    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('accepts all valid roles', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'client' });
    mockPrisma.user.update.mockResolvedValue({});

    for (const role of ['client', 'wholesaler', 'manager', 'admin']) {
      await updateUserRole(1, role);
    }
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(4);
  });
});

describe('approveWholesale', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(approveWholesale(999)).rejects.toThrow('Користувача не знайдено');
  });

  it('throws if status is not pending', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'approved' });
    await expect(approveWholesale(1)).rejects.toThrow('Запит не очікує розгляду');
  });

  it('approves wholesale request', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'pending' });
    const updated = { id: 1, role: 'wholesaler', wholesaleStatus: 'approved' };
    mockPrisma.user.update.mockResolvedValue(updated);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await approveWholesale(1, 10, 2);

    expect(result).toEqual(updated);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'wholesaler',
          wholesaleStatus: 'approved',
          wholesaleGroup: 2,
          assignedManagerId: 10,
        }),
      }),
    );
  });

  it('defaults wholesaleGroup to 1', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'pending' });
    mockPrisma.user.update.mockResolvedValue({ id: 1 });

    await approveWholesale(1);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wholesaleGroup: 1 }),
      }),
    );
  });
});

describe('rejectWholesale', () => {
  it('throws 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(rejectWholesale(999)).rejects.toThrow('Користувача не знайдено');
  });

  it('throws if status is not pending', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'approved' });
    await expect(rejectWholesale(1)).rejects.toThrow('Запит не очікує розгляду');
  });

  it('rejects wholesale request and creates audit log', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ wholesaleStatus: 'pending' });
    const updated = { id: 1, wholesaleStatus: 'rejected' };
    mockPrisma.user.update.mockResolvedValue(updated);
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await rejectWholesale(1, 10);

    expect(result).toEqual(updated);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'wholesale_reject' }),
      }),
    );
  });
});
