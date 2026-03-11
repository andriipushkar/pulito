import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

const mockGetEffectivePrice = vi.fn();
vi.mock('@/services/personal-price', () => ({
  getEffectivePrice: (...args: unknown[]) => mockGetEffectivePrice(...args),
}));

import { prisma } from '@/lib/prisma';
import {
  getCartItems,
  getCartWithPersonalPrices,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart,
  CartError,
} from './cart';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

const makeCartItem = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 1,
  productId: 10,
  quantity: 2,
  addedAt: new Date('2025-01-01'),
  product: {
    id: 10,
    name: 'Товар А',
    slug: 'tovar-a',
    code: 'A001',
    priceRetail: 100,
    priceWholesale: 80,
    quantity: 50,
    isPromo: false,
    isActive: true,
    imagePath: '/images/a.jpg',
    images: [{ pathThumbnail: '/thumbs/a.jpg' }],
  },
  ...overrides,
});

describe('getCartItems', () => {
  it('should return cart items for a user', async () => {
    const items = [makeCartItem()];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);

    const result = await getCartItems(1);

    expect(mockPrisma.cartItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        orderBy: { addedAt: 'desc' },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe(10);
  });

  it('should filter out inactive products', async () => {
    const items = [
      makeCartItem({ id: 1, productId: 10 }),
      makeCartItem({
        id: 2,
        productId: 20,
        product: {
          id: 20,
          name: 'Неактивний товар',
          slug: 'inactive',
          code: 'B001',
          priceRetail: 200,
          priceWholesale: 150,
          quantity: 10,
          isPromo: false,
          isActive: false,
          imagePath: '/images/b.jpg',
          images: [],
        },
      }),
    ];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);

    const result = await getCartItems(1);

    expect(result).toHaveLength(1);
    expect(result[0].product.isActive).toBe(true);
  });

  it('should return empty array when user has no items', async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue([] as never);

    const result = await getCartItems(1);

    expect(result).toEqual([]);
  });
});

describe('addToCart', () => {
  it('should create a new cart item when product is not in cart', async () => {
    const product = { id: 10, isActive: true, quantity: 50 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);
    mockPrisma.cartItem.findUnique.mockResolvedValue(null as never);

    const created = makeCartItem();
    mockPrisma.cartItem.create.mockResolvedValue(created as never);

    const result = await addToCart(1, 10, 2);

    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 1, productId: 10, quantity: 2 },
      })
    );
    expect(result).toEqual(created);
  });

  it('should update quantity when product already exists in cart', async () => {
    const product = { id: 10, isActive: true, quantity: 50 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);

    const existing = { id: 1, userId: 1, productId: 10, quantity: 3 };
    mockPrisma.cartItem.findUnique.mockResolvedValue(existing as never);

    const updated = makeCartItem({ quantity: 5 });
    mockPrisma.cartItem.update.mockResolvedValue(updated as never);

    const result = await addToCart(1, 10, 2);

    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { quantity: 5 },
      })
    );
    expect(result).toEqual(updated);
  });

  it('should throw 404 when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null as never);

    await expect(addToCart(1, 999, 1)).rejects.toThrow(CartError);
    await expect(addToCart(1, 999, 1)).rejects.toThrow('Товар не знайдено або недоступний');

    try {
      await addToCart(1, 999, 1);
    } catch (err) {
      expect((err as CartError).statusCode).toBe(404);
    }
  });

  it('should throw 404 when product is inactive', async () => {
    const product = { id: 10, isActive: false, quantity: 50 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);

    await expect(addToCart(1, 10, 1)).rejects.toThrow('Товар не знайдено або недоступний');
  });

  it('should throw 400 when requested quantity exceeds stock', async () => {
    const product = { id: 10, isActive: true, quantity: 3 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);

    await expect(addToCart(1, 10, 5)).rejects.toThrow(CartError);
    await expect(addToCart(1, 10, 5)).rejects.toThrow('Недостатньо товару. Доступно: 3 шт.');

    try {
      await addToCart(1, 10, 5);
    } catch (err) {
      expect((err as CartError).statusCode).toBe(400);
    }
  });

  it('should throw 400 when total quantity for existing item exceeds stock', async () => {
    const product = { id: 10, isActive: true, quantity: 5 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);

    const existing = { id: 1, userId: 1, productId: 10, quantity: 3 };
    mockPrisma.cartItem.findUnique.mockResolvedValue(existing as never);

    await expect(addToCart(1, 10, 3)).rejects.toThrow(CartError);
    await expect(addToCart(1, 10, 3)).rejects.toThrow('Недостатньо товару. Доступно: 5 шт.');

    try {
      await addToCart(1, 10, 3);
    } catch (err) {
      expect((err as CartError).statusCode).toBe(400);
    }
  });
});

describe('updateCartItem', () => {
  it('should update cart item quantity', async () => {
    const item = { id: 1, userId: 1, productId: 10, quantity: 2 };
    mockPrisma.cartItem.findUnique.mockResolvedValue(item as never);

    const product = { quantity: 50 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);

    const updated = makeCartItem({ quantity: 5 });
    mockPrisma.cartItem.update.mockResolvedValue(updated as never);

    const result = await updateCartItem(1, 10, 5);

    expect(mockPrisma.cartItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { quantity: 5 },
      })
    );
    expect(result).toEqual(updated);
  });

  it('should throw 404 when item is not in cart', async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValue(null as never);

    await expect(updateCartItem(1, 999, 3)).rejects.toThrow(CartError);
    await expect(updateCartItem(1, 999, 3)).rejects.toThrow('Товар не знайдено в кошику');

    try {
      await updateCartItem(1, 999, 3);
    } catch (err) {
      expect((err as CartError).statusCode).toBe(404);
    }
  });

  it('should throw 400 when quantity exceeds stock', async () => {
    const item = { id: 1, userId: 1, productId: 10, quantity: 2 };
    mockPrisma.cartItem.findUnique.mockResolvedValue(item as never);

    const product = { quantity: 5 };
    mockPrisma.product.findUnique.mockResolvedValue(product as never);

    await expect(updateCartItem(1, 10, 10)).rejects.toThrow(CartError);
    await expect(updateCartItem(1, 10, 10)).rejects.toThrow('Недостатньо товару. Доступно: 5 шт.');

    try {
      await updateCartItem(1, 10, 10);
    } catch (err) {
      expect((err as CartError).statusCode).toBe(400);
    }
  });
});

describe('removeFromCart', () => {
  it('should remove item from cart', async () => {
    const item = { id: 1, userId: 1, productId: 10, quantity: 2 };
    mockPrisma.cartItem.findUnique.mockResolvedValue(item as never);
    mockPrisma.cartItem.delete.mockResolvedValue(item as never);

    await removeFromCart(1, 10);

    expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should throw 404 when item is not in cart', async () => {
    mockPrisma.cartItem.findUnique.mockResolvedValue(null as never);

    await expect(removeFromCart(1, 999)).rejects.toThrow(CartError);
    await expect(removeFromCart(1, 999)).rejects.toThrow('Товар не знайдено в кошику');

    try {
      await removeFromCart(1, 999);
    } catch (err) {
      expect((err as CartError).statusCode).toBe(404);
    }
  });
});

describe('clearCart', () => {
  it('should delete all cart items for a user', async () => {
    mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 } as never);

    await clearCart(1);

    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
  });
});

describe('mergeCart', () => {
  it('should merge local items into db cart for new products', async () => {
    const localItems = [
      { productId: 10, quantity: 2 },
      { productId: 20, quantity: 3 },
    ];

    // Both items don't exist in cart
    mockPrisma.cartItem.findUnique
      .mockResolvedValueOnce(null as never) // item 10 not in cart
      .mockResolvedValueOnce(null as never); // item 20 not in cart

    // Both products are active
    mockPrisma.product.findUnique
      .mockResolvedValueOnce({ isActive: true, quantity: 50 } as never)
      .mockResolvedValueOnce({ isActive: true, quantity: 50 } as never);

    mockPrisma.cartItem.create
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);

    // getCartItems is called at the end of mergeCart
    const mergedItems = [makeCartItem({ productId: 10 }), makeCartItem({ productId: 20 })];
    mockPrisma.cartItem.findMany.mockResolvedValue(mergedItems as never);

    const result = await mergeCart(1, localItems);

    expect(mockPrisma.cartItem.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 1, productId: 10, quantity: 2 },
      })
    );
    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 1, productId: 20, quantity: 3 },
      })
    );
    expect(result).toHaveLength(2);
  });

  it('should skip items that already exist in cart', async () => {
    const localItems = [{ productId: 10, quantity: 2 }];

    // Item already exists
    const existing = { id: 1, userId: 1, productId: 10, quantity: 3 };
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(existing as never);

    // getCartItems at the end
    mockPrisma.cartItem.findMany.mockResolvedValue([makeCartItem()] as never);

    const result = await mergeCart(1, localItems);

    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('should skip inactive products', async () => {
    const localItems = [{ productId: 10, quantity: 2 }];

    // Item not in cart
    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null as never);

    // Product is inactive
    mockPrisma.product.findUnique.mockResolvedValueOnce({ isActive: false, quantity: 50 } as never);

    // getCartItems at the end
    mockPrisma.cartItem.findMany.mockResolvedValue([] as never);

    const result = await mergeCart(1, localItems);

    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should skip products with zero stock', async () => {
    const localItems = [{ productId: 10, quantity: 2 }];

    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.product.findUnique.mockResolvedValueOnce({ isActive: true, quantity: 0 } as never);

    mockPrisma.cartItem.findMany.mockResolvedValue([] as never);

    const result = await mergeCart(1, localItems);

    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should clamp quantity to available stock', async () => {
    const localItems = [{ productId: 10, quantity: 100 }];

    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.product.findUnique.mockResolvedValueOnce({ isActive: true, quantity: 5 } as never);
    mockPrisma.cartItem.create.mockResolvedValueOnce({} as never);

    mockPrisma.cartItem.findMany.mockResolvedValue([makeCartItem({ quantity: 5 })] as never);

    const result = await mergeCart(1, localItems);

    expect(mockPrisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 1, productId: 10, quantity: 5 },
      })
    );
    expect(result).toHaveLength(1);
  });

  it('should skip products that do not exist', async () => {
    const localItems = [{ productId: 10, quantity: 2 }];

    mockPrisma.cartItem.findUnique.mockResolvedValueOnce(null as never);
    mockPrisma.product.findUnique.mockResolvedValueOnce(null as never);

    mockPrisma.cartItem.findMany.mockResolvedValue([] as never);

    const result = await mergeCart(1, localItems);

    expect(mockPrisma.cartItem.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe('getCartWithPersonalPrices', () => {
  it('should return items with fixedPrice personal price', async () => {
    const items = [makeCartItem()];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: 5 } as never);
    mockGetEffectivePrice.mockResolvedValue({ fixedPrice: 85, discountPercent: null });

    const result = await getCartWithPersonalPrices(1);

    expect(result).toHaveLength(1);
    expect(result[0].personalPrice).toBe(85);
  });

  it('should return items with discountPercent personal price', async () => {
    const items = [makeCartItem()];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: 5 } as never);
    mockGetEffectivePrice.mockResolvedValue({ fixedPrice: null, discountPercent: 10 });

    const result = await getCartWithPersonalPrices(1);

    expect(result).toHaveLength(1);
    // 100 * (1 - 10/100) = 90, rounded
    expect(result[0].personalPrice).toBe(90);
  });

  it('should return null personalPrice when no effective price', async () => {
    const items = [makeCartItem()];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: 5 } as never);
    mockGetEffectivePrice.mockResolvedValue(null);

    const result = await getCartWithPersonalPrices(1);

    expect(result).toHaveLength(1);
    expect(result[0].personalPrice).toBeNull();
  });

  it('should return null personalPrice when effective has neither fixedPrice nor discountPercent', async () => {
    const items = [makeCartItem()];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);
    mockPrisma.product.findUnique.mockResolvedValue({ categoryId: 5 } as never);
    mockGetEffectivePrice.mockResolvedValue({ fixedPrice: null, discountPercent: null });

    const result = await getCartWithPersonalPrices(1);

    expect(result).toHaveLength(1);
    expect(result[0].personalPrice).toBeNull();
  });

  it('should handle product with no categoryId', async () => {
    const items = [makeCartItem()];
    mockPrisma.cartItem.findMany.mockResolvedValue(items as never);
    mockPrisma.product.findUnique.mockResolvedValue(null as never);
    mockGetEffectivePrice.mockResolvedValue(null);

    const result = await getCartWithPersonalPrices(1);

    expect(result).toHaveLength(1);
    expect(mockGetEffectivePrice).toHaveBeenCalledWith(1, 10, null);
  });
});

describe('updateCartItem', () => {
  it('should allow update when product is null (deleted product)', async () => {
    const item = { id: 1, userId: 1, productId: 10, quantity: 2 };
    mockPrisma.cartItem.findUnique.mockResolvedValue(item as never);
    mockPrisma.product.findUnique.mockResolvedValue(null as never);

    const updated = makeCartItem({ quantity: 3 });
    mockPrisma.cartItem.update.mockResolvedValue(updated as never);

    const result = await updateCartItem(1, 10, 3);
    expect(result).toEqual(updated);
  });
});

describe('CartError', () => {
  it('should create error with message and status code', () => {
    const error = new CartError('Test error', 400);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CartError);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('CartError');
  });
});
