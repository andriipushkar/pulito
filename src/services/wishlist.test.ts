import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    wishlist: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    wishlistItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as unknown as MockPrismaClient;

import {
  WishlistError,
  getOrCreateDefaultWishlist,
  resolveWishlistId,
  isProductInWishlist,
  getUserWishlists,
  getWishlistById,
  createWishlist,
  updateWishlist,
  deleteWishlist,
  deleteEmptyWishlists,
  addItemToWishlist,
  removeItemFromWishlist,
} from './wishlist';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WishlistError', () => {
  it('should set name, message, and statusCode', () => {
    const error = new WishlistError('test error', 404);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WishlistError');
    expect(error.message).toBe('test error');
    expect(error.statusCode).toBe(404);
  });
});

describe('getOrCreateDefaultWishlist', () => {
  const userId = 1;
  const existingWishlist = { id: 10, userId, name: 'Обране', createdAt: new Date() };

  it('should return existing wishlist if one exists', async () => {
    mockPrisma.wishlist.findFirst.mockResolvedValue(existingWishlist);

    const result = await getOrCreateDefaultWishlist(userId);

    expect(result).toEqual(existingWishlist);
    expect(mockPrisma.wishlist.findFirst).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(mockPrisma.wishlist.create).not.toHaveBeenCalled();
  });

  it('should create a new wishlist if none exists', async () => {
    mockPrisma.wishlist.findFirst.mockResolvedValue(null);
    mockPrisma.wishlist.create.mockResolvedValue(existingWishlist);

    const result = await getOrCreateDefaultWishlist(userId);

    expect(result).toEqual(existingWishlist);
    expect(mockPrisma.wishlist.create).toHaveBeenCalledWith({
      data: { userId, name: 'Обране' },
    });
  });

  it('should handle race condition by finding existing after create fails', async () => {
    mockPrisma.wishlist.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingWishlist);
    mockPrisma.wishlist.create.mockRejectedValue(new Error('Unique constraint'));

    const result = await getOrCreateDefaultWishlist(userId);

    expect(result).toEqual(existingWishlist);
    expect(mockPrisma.wishlist.findFirst).toHaveBeenCalledTimes(2);
  });

  it('should throw WishlistError 500 if race condition fallback also fails', async () => {
    mockPrisma.wishlist.findFirst.mockResolvedValue(null);
    mockPrisma.wishlist.create.mockRejectedValue(new Error('Unique constraint'));

    await expect(getOrCreateDefaultWishlist(userId)).rejects.toThrow(WishlistError);
    await expect(getOrCreateDefaultWishlist(userId)).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

describe('resolveWishlistId', () => {
  const userId = 1;

  it('should resolve "default" by calling getOrCreateDefaultWishlist', async () => {
    mockPrisma.wishlist.findFirst.mockResolvedValue({ id: 5, userId, name: 'Обране' });

    const result = await resolveWishlistId(userId, 'default');

    expect(result).toBe(5);
    expect(mockPrisma.wishlist.findFirst).toHaveBeenCalled();
  });

  it('should parse a numeric string', async () => {
    const result = await resolveWishlistId(userId, '42');

    expect(result).toBe(42);
    expect(mockPrisma.wishlist.findFirst).not.toHaveBeenCalled();
  });

  it('should throw WishlistError 400 for invalid id', async () => {
    await expect(resolveWishlistId(userId, 'abc')).rejects.toThrow(WishlistError);
    await expect(resolveWishlistId(userId, 'abc')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('isProductInWishlist', () => {
  it('should return true when item exists', async () => {
    mockPrisma.wishlistItem.findUnique.mockResolvedValue({ id: 1 });

    const result = await isProductInWishlist(1, 10, 100);

    expect(result).toBe(true);
    expect(mockPrisma.wishlistItem.findUnique).toHaveBeenCalledWith({
      where: { wishlistId_productId: { wishlistId: 10, productId: 100 } },
    });
  });

  it('should return false when item does not exist', async () => {
    mockPrisma.wishlistItem.findUnique.mockResolvedValue(null);

    const result = await isProductInWishlist(1, 10, 100);

    expect(result).toBe(false);
  });
});

describe('getUserWishlists', () => {
  it('should call prisma.wishlist.findMany with correct params', async () => {
    const wishlists = [{ id: 1, userId: 1, name: 'Обране', items: [] }];
    mockPrisma.wishlist.findMany.mockResolvedValue(wishlists);

    const result = await getUserWishlists(1);

    expect(result).toEqual(wishlists);
    expect(mockPrisma.wishlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});

describe('getWishlistById', () => {
  const userId = 1;
  const wishlistId = 10;

  it('should return wishlist when found and owned by user', async () => {
    const wishlist = { id: wishlistId, userId, name: 'Test', items: [] };
    mockPrisma.wishlist.findUnique.mockResolvedValue(wishlist);

    const result = await getWishlistById(userId, wishlistId);

    expect(result).toEqual(wishlist);
    expect(mockPrisma.wishlist.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: wishlistId } })
    );
  });

  it('should throw 404 when wishlist not found', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue(null);

    await expect(getWishlistById(userId, wishlistId)).rejects.toThrow(WishlistError);
    await expect(getWishlistById(userId, wishlistId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Список не знайдено',
    });
  });

  it('should throw 404 when wishlist belongs to different user', async () => {
    const wishlist = { id: wishlistId, userId: 999, name: 'Test', items: [] };
    mockPrisma.wishlist.findUnique.mockResolvedValue(wishlist);

    await expect(getWishlistById(userId, wishlistId)).rejects.toThrow(WishlistError);
    await expect(getWishlistById(userId, wishlistId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('createWishlist', () => {
  it('should call prisma.wishlist.create with correct data', async () => {
    const created = { id: 5, userId: 1, name: 'New List', items: [], _count: { items: 0 } };
    mockPrisma.wishlist.create.mockResolvedValue(created);

    const result = await createWishlist(1, 'New List');

    expect(result).toEqual(created);
    expect(mockPrisma.wishlist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 1, name: 'New List' },
      })
    );
  });
});

describe('updateWishlist', () => {
  const userId = 1;
  const wishlistId = 10;

  it('should update the wishlist name', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    const updated = { id: wishlistId, userId, name: 'Updated' };
    mockPrisma.wishlist.update.mockResolvedValue(updated);

    const result = await updateWishlist(userId, wishlistId, 'Updated');

    expect(result).toEqual(updated);
    expect(mockPrisma.wishlist.update).toHaveBeenCalledWith({
      where: { id: wishlistId },
      data: { name: 'Updated' },
    });
  });

  it('should throw 404 when wishlist not found', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue(null);

    await expect(updateWishlist(userId, wishlistId, 'X')).rejects.toThrow(WishlistError);
    await expect(updateWishlist(userId, wishlistId, 'X')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should throw 404 when wishlist belongs to different user', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId: 999 });

    await expect(updateWishlist(userId, wishlistId, 'X')).rejects.toThrow(WishlistError);
    await expect(updateWishlist(userId, wishlistId, 'X')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('deleteWishlist', () => {
  const userId = 1;
  const wishlistId = 10;

  it('should delete wishlist and items in a transaction', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.wishlist.delete.mockResolvedValue({ id: wishlistId });
    mockPrisma.$transaction.mockResolvedValue([{ count: 3 }, { id: wishlistId }]);

    await deleteWishlist(userId, wishlistId);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('should throw 404 when wishlist not found', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue(null);

    await expect(deleteWishlist(userId, wishlistId)).rejects.toThrow(WishlistError);
    await expect(deleteWishlist(userId, wishlistId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should throw 404 when wishlist belongs to different user', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId: 999 });

    await expect(deleteWishlist(userId, wishlistId)).rejects.toThrow(WishlistError);
    await expect(deleteWishlist(userId, wishlistId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('deleteEmptyWishlists', () => {
  const userId = 1;

  it('should delete empty wishlists and return count', async () => {
    mockPrisma.wishlist.findMany.mockResolvedValue([
      { id: 1, userId, createdAt: new Date('2024-01-01'), _count: { items: 2 } },
      { id: 2, userId, createdAt: new Date('2024-02-01'), _count: { items: 0 } },
      { id: 3, userId, createdAt: new Date('2024-03-01'), _count: { items: 0 } },
    ]);
    mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.wishlist.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 2 }]);

    const result = await deleteEmptyWishlists(userId);

    expect(result).toBe(2);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should keep at least one wishlist when all are empty', async () => {
    mockPrisma.wishlist.findMany.mockResolvedValue([
      { id: 1, userId, createdAt: new Date('2024-01-01'), _count: { items: 0 } },
      { id: 2, userId, createdAt: new Date('2024-02-01'), _count: { items: 0 } },
    ]);
    mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.wishlist.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, { count: 1 }]);

    const result = await deleteEmptyWishlists(userId);

    // Should keep the oldest (id: 1) and only delete id: 2
    expect(result).toBe(1);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should return 0 when no empty wishlists exist', async () => {
    mockPrisma.wishlist.findMany.mockResolvedValue([
      { id: 1, userId, createdAt: new Date('2024-01-01'), _count: { items: 3 } },
    ]);

    const result = await deleteEmptyWishlists(userId);

    expect(result).toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should return 0 when user has no wishlists', async () => {
    mockPrisma.wishlist.findMany.mockResolvedValue([]);

    const result = await deleteEmptyWishlists(userId);

    expect(result).toBe(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('addItemToWishlist', () => {
  const userId = 1;
  const wishlistId = 10;
  const productId = 100;

  it('should add item to wishlist', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    mockPrisma.product.findUnique.mockResolvedValue({ id: productId, isActive: true });
    mockPrisma.wishlistItem.findUnique.mockResolvedValue(null);
    const createdItem = { wishlistId, productId, product: { id: productId } };
    mockPrisma.wishlistItem.create.mockResolvedValue(createdItem);

    const result = await addItemToWishlist(userId, wishlistId, productId);

    expect(result).toEqual(createdItem);
    expect(mockPrisma.wishlistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { wishlistId, productId },
      })
    );
  });

  it('should throw 404 when wishlist not found', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue(null);

    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Список не знайдено',
    });
  });

  it('should throw 404 when wishlist belongs to different user', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId: 999 });

    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should throw 404 when product not found', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Товар не знайдено',
    });
  });

  it('should throw 409 when product already in wishlist', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    mockPrisma.product.findUnique.mockResolvedValue({ id: productId, isActive: true });
    mockPrisma.wishlistItem.findUnique.mockResolvedValue({ wishlistId, productId });

    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(addItemToWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Товар вже в списку',
    });
  });
});

describe('removeItemFromWishlist', () => {
  const userId = 1;
  const wishlistId = 10;
  const productId = 100;

  it('should remove item from wishlist', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    mockPrisma.wishlistItem.findUnique.mockResolvedValue({ wishlistId, productId });
    mockPrisma.wishlistItem.delete.mockResolvedValue({ wishlistId, productId });

    await removeItemFromWishlist(userId, wishlistId, productId);

    expect(mockPrisma.wishlistItem.delete).toHaveBeenCalledWith({
      where: { wishlistId_productId: { wishlistId, productId } },
    });
  });

  it('should throw 404 when wishlist not found', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue(null);

    await expect(removeItemFromWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(removeItemFromWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Список не знайдено',
    });
  });

  it('should throw 404 when wishlist belongs to different user', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId: 999 });

    await expect(removeItemFromWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(removeItemFromWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should throw 404 when item not found in wishlist', async () => {
    mockPrisma.wishlist.findUnique.mockResolvedValue({ id: wishlistId, userId });
    mockPrisma.wishlistItem.findUnique.mockResolvedValue(null);

    await expect(removeItemFromWishlist(userId, wishlistId, productId)).rejects.toThrow(WishlistError);
    await expect(removeItemFromWishlist(userId, wishlistId, productId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Товар не знайдено в списку',
    });
  });
});
