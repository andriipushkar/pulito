import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    order: { updateMany: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    userAddress: { deleteMany: vi.fn() },
    userNotification: { deleteMany: vi.fn() },
    refreshToken: { findMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { AccountError, deleteAccount } from './account';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountError', () => {
  it('has correct name and statusCode', () => {
    const err = new AccountError('test', 403);
    expect(err.name).toBe('AccountError');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('test');
  });
});

describe('deleteAccount', () => {
  it('throws 404 for missing user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(deleteAccount(999)).rejects.toThrow(AccountError);
    await expect(deleteAccount(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('anonymizes data and returns void', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, email: 'user@example.com' } as any);
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.userAddress.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.userNotification.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.refreshToken.findMany).mockResolvedValue([]);

    const result = await deleteAccount(1);

    expect(result).toBeUndefined();
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: expect.objectContaining({
        contactName: 'Видалений користувач',
        contactPhone: '0000000000',
        contactEmail: 'deleted_1@anonymized.local',
        deliveryAddress: null,
        comment: null,
      }),
    });
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(prisma.userAddress.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(prisma.userNotification.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        email: 'deleted_1@anonymized.local',
        fullName: 'Видалений користувач',
        phone: null,
        passwordHash: null,
        isVerified: false,
      }),
    });
  });

  it('revokes remaining tokens', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, email: 'u@e.com' } as any);
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.cartItem.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.userAddress.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.userNotification.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.refreshToken.findMany).mockResolvedValue([
      { id: 10, userId: 1, revokedAt: null },
      { id: 11, userId: 1, revokedAt: null },
    ] as any);
    vi.mocked(prisma.refreshToken.update).mockResolvedValue({} as any);

    await deleteAccount(1);

    expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
      where: { userId: 1, revokedAt: null },
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledTimes(2);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
