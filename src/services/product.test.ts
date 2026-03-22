import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import {
  ProductError,
  getProducts,
  getProductBySlug,
  getProductById,
  searchAutocomplete,
  createProduct,
  updateProduct,
  deleteProduct,
  getPromoProducts,
  getNewProducts,
  getPopularProducts,
  applyPersonalPricing,
} from './product';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    priceHistory: {
      create: vi.fn(),
    },
    slugRedirect: {
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock('@/services/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

vi.mock('@/utils/slug', () => ({
  createSlug: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, '-')),
}));

vi.mock('@/services/personal-price', () => ({
  getEffectivePrice: vi.fn(),
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// ProductError
// ---------------------------------------------------------------------------
describe('ProductError', () => {
  it('should create an error with message and statusCode', () => {
    const error = new ProductError('Товар не знайдено', 404);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProductError);
    expect(error.message).toBe('Товар не знайдено');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ProductError');
  });

  it('should support different status codes', () => {
    const error = new ProductError('Товар з таким кодом вже існує', 409);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('Товар з таким кодом вже існує');
  });
});

// ---------------------------------------------------------------------------
// getProductBySlug
// ---------------------------------------------------------------------------
describe('getProductBySlug', () => {
  it('should return product with personalPrice when found', async () => {
    const mockProduct = {
      id: 1,
      name: 'Test Product',
      slug: 'test-product',
      priceRetail: 100,
      categoryId: 2,
      category: { id: 2, name: 'Cat', slug: 'cat' },
    };
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await getProductBySlug('test-product');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.slug).toBe('test-product');
    expect(result!.personalPrice).toBeNull();
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'test-product', isActive: true },
      })
    );
  });

  it('should increment view count asynchronously', async () => {
    const mockProduct = { id: 5, slug: 'item', priceRetail: 50, categoryId: null };
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    await getProductBySlug('item');

    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { viewsCount: { increment: 1 } },
    });
  });

  it('should return null when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const result = await getProductBySlug('nonexistent');

    expect(result).toBeNull();
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('should apply personal pricing when userId is provided', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue({
      fixedPrice: 80,
      discountPercent: null,
    } as never);

    const mockProduct = {
      id: 1,
      slug: 'test',
      priceRetail: 100,
      categoryId: 3,
      category: { id: 3 },
    };
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await getProductBySlug('test', 42);

    expect(result).not.toBeNull();
    expect(result!.personalPrice).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// getProductById
// ---------------------------------------------------------------------------
describe('getProductById', () => {
  it('should return product when found', async () => {
    const mockProduct = {
      id: 10,
      name: 'Product Ten',
      priceRetail: 200,
      categoryId: null,
    };
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);

    const result = await getProductById(10);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(10);
    expect(result!.personalPrice).toBeNull();
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 } })
    );
  });

  it('should return null when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const result = await getProductById(999);

    expect(result).toBeNull();
  });

  it('should apply personal pricing with discount percent', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue({
      fixedPrice: null,
      discountPercent: 10,
    } as never);

    const mockProduct = {
      id: 1,
      priceRetail: 200,
      categoryId: 5,
      category: { id: 5 },
    };
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);

    const result = await getProductById(1, 7);

    expect(result).not.toBeNull();
    // 200 * (1 - 10/100) = 180
    expect(result!.personalPrice).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// searchAutocomplete
// ---------------------------------------------------------------------------
describe('searchAutocomplete', () => {
  it('should return products and categories matching query', async () => {
    const mockProductIds = [{ id: 1 }, { id: 2 }];
    mockPrisma.$queryRaw.mockResolvedValue(mockProductIds as never);

    const mockProducts = [
      { id: 1, name: 'Soap A', slug: 'soap-a', code: 'S001', priceRetail: 50, images: [] },
      { id: 2, name: 'Soap B', slug: 'soap-b', code: 'S002', priceRetail: 60, images: [] },
    ];
    mockPrisma.product.findMany.mockResolvedValue(mockProducts as never);

    const mockCategories = [
      { id: 10, name: 'Soaps', slug: 'soaps', _count: { products: 15 } },
    ];
    (mockPrisma as never as { category: { findMany: ReturnType<typeof vi.fn> } }).category.findMany.mockResolvedValue(mockCategories as never);

    const result = await searchAutocomplete('soap');

    expect(result.products).toHaveLength(2);
    expect(result.categories).toHaveLength(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  it('should return empty products when no ids matched', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([] as never);
    (mockPrisma as never as { category: { findMany: ReturnType<typeof vi.fn> } }).category.findMany.mockResolvedValue([] as never);

    const result = await searchAutocomplete('zzzzz');

    expect(result.products).toEqual([]);
    expect(result.categories).toEqual([]);
    // findMany for products should not be called when no ids
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createProduct
// ---------------------------------------------------------------------------
describe('createProduct', () => {
  it('should create product with generated slug', async () => {
    // No existing product with same code
    mockPrisma.product.findUnique
      .mockResolvedValueOnce(null) // code check
      .mockResolvedValueOnce(null); // slug check

    const created = {
      id: 1,
      code: 'P001',
      name: 'New Product',
      slug: 'new-product',
      priceRetail: 150,
    };
    mockPrisma.product.create.mockResolvedValue(created as never);

    const result = await createProduct({
      code: 'P001',
      name: 'New Product',
      priceRetail: 150,
    });

    expect(result).toEqual(created);
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'P001',
          name: 'New Product',
          slug: 'new-product',
          priceRetail: 150,
        }),
      })
    );
  });

  it('should append code to slug when slug already exists', async () => {
    mockPrisma.product.findUnique
      .mockResolvedValueOnce(null) // code check
      .mockResolvedValueOnce({ id: 99 } as never); // slug exists

    mockPrisma.product.create.mockResolvedValue({ id: 2 } as never);

    await createProduct({
      code: 'P002',
      name: 'New Product',
      priceRetail: 100,
    });

    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'new-product-p002',
        }),
      })
    );
  });

  it('should throw 409 if product code already exists', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 1 } as never);

    await expect(
      createProduct({ code: 'P001', name: 'Dup', priceRetail: 100 })
    ).rejects.toThrow(ProductError);

    await expect(
      createProduct({ code: 'P001', name: 'Dup', priceRetail: 100 })
    ).rejects.toThrow('Товар з таким кодом вже існує');
  });

  it('should throw 404 if category not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValueOnce(null); // code check
    (mockPrisma as never as { category: { findUnique: ReturnType<typeof vi.fn> } }).category.findUnique.mockResolvedValue(null);

    await expect(
      createProduct({ code: 'P003', name: 'Test', priceRetail: 100, categoryId: 999 })
    ).rejects.toThrow(ProductError);
  });

  it('should create product with all optional fields', async () => {
    mockPrisma.product.findUnique
      .mockResolvedValueOnce(null) // code check
      .mockResolvedValueOnce(null); // slug check
    (mockPrisma as never as { category: { findUnique: ReturnType<typeof vi.fn> } }).category.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.product.create.mockResolvedValue({ id: 3 } as never);

    await createProduct({
      code: 'P004',
      name: 'Full Product',
      priceRetail: 200,
      priceWholesale: 150,
      categoryId: 1,
      quantity: 50,
      isPromo: true,
      isActive: true,
      sortOrder: 5,
    });

    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceWholesale: 150,
          quantity: 50,
          isPromo: true,
          isActive: true,
          sortOrder: 5,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateProduct
// ---------------------------------------------------------------------------
describe('updateProduct', () => {
  it('should update product successfully', async () => {
    const existing = {
      id: 1,
      code: 'P001',
      name: 'Old Name',
      priceRetail: 100,
      priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1, quantity: 25 } as never);

    const result = await updateProduct(1, { quantity: 25 });

    expect(result).toEqual({ id: 1, quantity: 25 });
    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ quantity: 25 }),
      })
    );
  });

  it('should throw 404 when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(updateProduct(999, { name: 'X' })).rejects.toThrow(ProductError);
    await expect(updateProduct(999, { name: 'X' })).rejects.toThrow('Товар не знайдено');
  });

  it('should track price history when retail price changes', async () => {
    const existing = {
      id: 1,
      code: 'P001',
      name: 'Product',
      priceRetail: 100,
      priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.priceHistory.create.mockResolvedValue({} as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { priceRetail: 120 });

    expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
      data: {
        productId: 1,
        priceRetailOld: 100,
        priceRetailNew: 120,
        priceWholesaleOld: 80,
        priceWholesaleNew: 80,
      },
    });
  });

  it('should not create price history when price stays the same', async () => {
    const existing = {
      id: 1,
      code: 'P001',
      name: 'Product',
      priceRetail: 100,
      priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { priceRetail: 100 });

    expect(mockPrisma.priceHistory.create).not.toHaveBeenCalled();
  });

  it('should throw 409 if updated code conflicts with another product', async () => {
    const existing = { id: 1, code: 'P001', priceRetail: 100, priceWholesale: 80 };
    mockPrisma.product.findUnique
      .mockResolvedValueOnce(existing as never) // find existing
      .mockResolvedValueOnce({ id: 2, code: 'P002' } as never); // code conflict

    await expect(updateProduct(1, { code: 'P002' })).rejects.toThrow(ProductError);
    await expect(updateProduct(1, { code: 'P002' })).rejects.toThrow('Товар з таким кодом вже існує');
  });

  it('should regenerate slug when name changes', async () => {
    const existing = {
      id: 1,
      code: 'p001',
      name: 'Old Name',
      priceRetail: 100,
      priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.findFirst.mockResolvedValue(null); // no slug conflict
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { name: 'New Name' });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New Name',
          slug: 'new-name',
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// deleteProduct
// ---------------------------------------------------------------------------
describe('deleteProduct', () => {
  it('should soft-delete (deactivate) the product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    await deleteProduct(1);

    const call = mockPrisma.product.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 1 });
    // Soft delete sets deletedAt and/or isActive: false
    expect(call.data.isActive === false || call.data.deletedAt).toBeTruthy();
  });

  it('should throw 404 when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(deleteProduct(999)).rejects.toThrow(ProductError);
    await expect(deleteProduct(999)).rejects.toThrow('Товар не знайдено');
  });
});

// ---------------------------------------------------------------------------
// getPromoProducts
// ---------------------------------------------------------------------------
describe('getPromoProducts', () => {
  it('should return promo products with default limit', async () => {
    const promoItems = [
      { id: 1, name: 'Promo 1', isPromo: true },
      { id: 2, name: 'Promo 2', isPromo: true },
    ];
    mockPrisma.product.findMany.mockResolvedValue(promoItems as never);

    const result = await getPromoProducts();

    expect(result).toEqual(promoItems);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, isPromo: true, quantity: { gt: 0 } },
        orderBy: { ordersCount: 'desc' },
        take: 10,
      })
    );
  });

  it('should respect custom limit', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await getPromoProducts(5);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

// ---------------------------------------------------------------------------
// getNewProducts
// ---------------------------------------------------------------------------
describe('getNewProducts', () => {
  it('should return newest products ordered by createdAt desc', async () => {
    const newItems = [{ id: 3, name: 'Newest' }];
    mockPrisma.product.findMany.mockResolvedValue(newItems as never);

    const result = await getNewProducts();

    expect(result).toEqual(newItems);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    );
  });

  it('should respect custom limit', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await getNewProducts(3);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    );
  });
});

// ---------------------------------------------------------------------------
// getPopularProducts
// ---------------------------------------------------------------------------
describe('getPopularProducts', () => {
  it('should return popular products ordered by ordersCount desc', async () => {
    const popularItems = [
      { id: 5, name: 'Bestseller', ordersCount: 100 },
      { id: 6, name: 'Popular', ordersCount: 80 },
    ];
    mockPrisma.product.findMany.mockResolvedValue(popularItems as never);

    const result = await getPopularProducts();

    expect(result).toEqual(popularItems);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, quantity: { gt: 0 } },
        orderBy: { ordersCount: 'desc' },
        take: 10,
      })
    );
  });

  it('should respect custom limit', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);

    await getPopularProducts(20);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });
});

// ---------------------------------------------------------------------------
// getProducts
// ---------------------------------------------------------------------------
describe('getProducts', () => {
  it('should return cached result when available', async () => {
    const { cacheGet } = await import('@/services/cache');
    vi.mocked(cacheGet).mockResolvedValueOnce({ products: [{ id: 1 }], total: 1 });

    const result = await getProducts({ page: 1, limit: 10, sort: 'popular' });

    expect(result).toEqual({ products: [{ id: 1 }], total: 1 });
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
  });

  it('should query products with no filters', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    const result = await getProducts({ page: 1, limit: 10, sort: 'popular' });

    expect(result).toEqual({ products: [], total: 0 });
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        skip: 0,
        take: 10,
      })
    );
  });

  it('should apply category filter', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'popular', category: 'soap' });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { slug: 'soap' },
        }),
      })
    );
  });

  it('should apply price range filters', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'popular', priceMin: 50, priceMax: 200 });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          priceRetail: { gte: 50, lte: 200 },
        }),
      })
    );
  });

  it('should apply priceMin only filter', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'popular', priceMin: 50 });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          priceRetail: { gte: 50 },
        }),
      })
    );
  });

  it('should apply promo filter', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'popular', promo: true });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPromo: true,
        }),
      })
    );
  });

  it('should apply inStock filter', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'popular', inStock: true });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          quantity: { gt: 0 },
        }),
      })
    );
  });

  it('should use full-text search when search query is provided', async () => {
    mockPrisma.$queryRawUnsafe = vi.fn()
      .mockResolvedValueOnce([{ count: BigInt(2) }] as never) // count
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }] as never) as never; // rank
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Soap A', priceRetail: 50 },
      { id: 2, name: 'Soap B', priceRetail: 60 },
    ] as never);

    const result = await getProducts({ page: 1, limit: 10, sort: 'popular', search: 'soap' });

    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should return empty when full-text search returns no results', async () => {
    mockPrisma.$queryRawUnsafe = vi.fn()
      .mockResolvedValueOnce([{ count: BigInt(0) }] as never) as never;

    const result = await getProducts({ page: 1, limit: 10, sort: 'popular', search: 'nonexistent' });

    expect(result).toEqual({ products: [], total: 0 });
  });

  it('should skip search for queries shorter than 2 chars', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'popular', search: 'a' });

    // Should use standard query, not full-text search
    expect(mockPrisma.product.findMany).toHaveBeenCalled();
  });

  it('should sort by price_asc', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'price_asc' });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priceRetail: 'asc' }],
      })
    );
  });

  it('should sort by price_desc', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'price_desc' });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priceRetail: 'desc' }],
      })
    );
  });

  it('should sort by name_asc', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'name_asc' });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: 'asc' }],
      })
    );
  });

  it('should sort by newest', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 1, limit: 10, sort: 'newest' });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }],
      })
    );
  });

  it('should apply search filters in full-text search', async () => {
    mockPrisma.$queryRawUnsafe = vi.fn()
      .mockResolvedValueOnce([{ count: BigInt(1) }] as never)
      .mockResolvedValueOnce([{ id: 1 }] as never) as never;
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Soap', priceRetail: 50 },
    ] as never);

    await getProducts({
      page: 1, limit: 10, sort: 'popular', search: 'soap',
      category: 'cleaning', priceMin: 10, priceMax: 100, promo: true, inStock: true,
    });

    // Verify $queryRawUnsafe was called with filter params
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it('should calculate correct pagination skip', async () => {
    mockPrisma.product.findMany.mockResolvedValue([] as never);
    mockPrisma.product.count.mockResolvedValue(0 as never);

    await getProducts({ page: 3, limit: 20, sort: 'popular' });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 })
    );
  });
});

// ---------------------------------------------------------------------------
// applyPersonalPricing
// ---------------------------------------------------------------------------
describe('applyPersonalPricing', () => {
  it('should return null when userId is null', async () => {
    const result = await applyPersonalPricing({ id: 1, priceRetail: 100 }, null);
    expect(result).toBeNull();
  });

  it('should return null when no effective price found', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue(null as never);

    const result = await applyPersonalPricing({ id: 1, priceRetail: 100, categoryId: 1 }, 1);
    expect(result).toBeNull();
  });

  it('should return fixedPrice when set', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue({
      fixedPrice: 75, discountPercent: null,
    } as never);

    const result = await applyPersonalPricing({ id: 1, priceRetail: 100, categoryId: 1 }, 1);
    expect(result).toBe(75);
  });

  it('should calculate discount when discountPercent is set', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue({
      fixedPrice: null, discountPercent: 25,
    } as never);

    const result = await applyPersonalPricing({ id: 1, priceRetail: 200, categoryId: 1 }, 1);
    // 200 * (1 - 25/100) = 150
    expect(result).toBe(150);
  });

  it('should return null when both fixedPrice and discountPercent are null', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue({
      fixedPrice: null, discountPercent: null,
    } as never);

    const result = await applyPersonalPricing({ id: 1, priceRetail: 100, categoryId: 1 }, 1);
    expect(result).toBeNull();
  });

  it('should use category.id when categoryId is not available', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue(null as never);

    await applyPersonalPricing({ id: 1, priceRetail: 100, category: { id: 5 } }, 1);

    expect(getEffectivePrice).toHaveBeenCalledWith(1, 1, 5);
  });

  it('should pass null category when neither categoryId nor category.id exists', async () => {
    const { getEffectivePrice } = await import('@/services/personal-price');
    vi.mocked(getEffectivePrice).mockResolvedValue(null as never);

    await applyPersonalPricing({ id: 1, priceRetail: 100 }, 1);

    expect(getEffectivePrice).toHaveBeenCalledWith(1, 1, null);
  });
});

// ---------------------------------------------------------------------------
// updateProduct - additional branches
// ---------------------------------------------------------------------------
describe('updateProduct - additional branches', () => {
  it('should track wholesale price changes', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product', slug: 'product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { priceWholesale: 70 });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceWholesaleOld: 80,
          priceWholesale: 70,
        }),
      })
    );
  });

  it('should not track wholesale price when it stays the same', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product', slug: 'product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { priceWholesale: 80 });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceWholesale: 80,
        }),
      })
    );
    // Should NOT contain priceWholesaleOld
    const updateData = mockPrisma.product.update.mock.calls[0][0].data;
    expect(updateData.priceWholesaleOld).toBeUndefined();
  });

  it('should create slug redirect when name changes and slug differs', async () => {
    const existing = {
      id: 1, code: 'p001', name: 'Old Name', slug: 'old-name',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.findFirst.mockResolvedValue(null as never);
    mockPrisma.slugRedirect.upsert.mockResolvedValue({} as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { name: 'New Name' });

    expect(mockPrisma.slugRedirect.upsert).toHaveBeenCalledWith({
      where: { oldSlug: 'old-name' },
      update: { newSlug: 'new-name', type: 'product' },
      create: { oldSlug: 'old-name', newSlug: 'new-name', type: 'product' },
    });
  });

  it('should append code to slug when name changes and slug conflicts', async () => {
    const existing = {
      id: 1, code: 'p001', name: 'Old Name', slug: 'old-name',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.findFirst.mockResolvedValue({ id: 2, slug: 'new-name' } as never);
    mockPrisma.slugRedirect.upsert.mockResolvedValue({} as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { name: 'New Name' });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'new-name-p001',
        }),
      })
    );
  });

  it('should validate category exists when categoryId is changed', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    (mockPrisma as never as { category: { findUnique: ReturnType<typeof vi.fn> } }).category.findUnique.mockResolvedValue(null);

    await expect(updateProduct(1, { categoryId: 999 })).rejects.toThrow(ProductError);
  });

  it('should disconnect category when categoryId is set to null', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { categoryId: null });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: { disconnect: true },
        }),
      })
    );
  });

  it('should connect category when categoryId is a valid number', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    (mockPrisma as never as { category: { findUnique: ReturnType<typeof vi.fn> } }).category.findUnique.mockResolvedValue({ id: 5 } as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { categoryId: 5 });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: { connect: { id: 5 } },
        }),
      })
    );
  });

  it('should not create slug redirect when slug does not change', async () => {
    const existing = {
      id: 1, code: 'p001', name: 'Same Name', slug: 'same-name',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.findFirst.mockResolvedValue(null as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { name: 'Same Name' });

    // name is being set but it hasn't changed, so slug shouldn't change
    expect(mockPrisma.slugRedirect.upsert).not.toHaveBeenCalled();
  });

  it('should update all optional fields', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, {
      code: 'P001', // same code
      quantity: 50,
      isPromo: true,
      isActive: false,
      sortOrder: 10,
    });

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'P001',
          quantity: 50,
          isPromo: true,
          isActive: false,
          sortOrder: 10,
        }),
      })
    );
  });

  it('should include wholesale price in history when retail price changes', async () => {
    const existing = {
      id: 1, code: 'P001', name: 'Product',
      priceRetail: 100, priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existing as never);
    mockPrisma.priceHistory.create.mockResolvedValue({} as never);
    mockPrisma.product.update.mockResolvedValue({ id: 1 } as never);

    await updateProduct(1, { priceRetail: 120, priceWholesale: 90 });

    expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
      data: {
        productId: 1,
        priceRetailOld: 100,
        priceRetailNew: 120,
        priceWholesaleOld: 80,
        priceWholesaleNew: 90,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// searchAutocomplete - cache hit (line 427)
// ---------------------------------------------------------------------------
describe('searchAutocomplete - cache hit', () => {
  it('should return cached result when available', async () => {
    const { cacheGet } = await import('@/services/cache');
    const cachedResult = {
      products: [{ id: 1, name: 'Cached Soap', slug: 'cached-soap' }],
      categories: [{ id: 5, name: 'Cached Cat', slug: 'cached-cat' }],
    };
    vi.mocked(cacheGet).mockResolvedValueOnce(cachedResult);

    const result = await searchAutocomplete('soap');

    expect(result).toEqual(cachedResult);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// serializeProduct - Decimal fields
// ---------------------------------------------------------------------------
describe('getProductBySlug - serialization', () => {
  it('should convert Decimal-like fields to numbers', async () => {
    const mockProduct = {
      id: 1,
      slug: 'test',
      priceRetail: { toString: () => '99.99' },
      priceWholesale: { toString: () => '79.99' },
      priceRetailOld: { toString: () => '109.99' },
      priceWholesaleOld: null,
      categoryId: null,
    };
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await getProductBySlug('test');

    expect(result).not.toBeNull();
    expect(typeof result!.priceRetail).toBe('number');
    expect(typeof result!.priceWholesale).toBe('number');
    expect(typeof result!.priceRetailOld).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// getProductBySlug - cache hit
// ---------------------------------------------------------------------------
describe('getProductBySlug - cache', () => {
  it('should return cached product and still increment views', async () => {
    const { cacheGet } = await import('@/services/cache');
    const cachedProduct = {
      id: 10, slug: 'cached', priceRetail: 100, categoryId: null,
    };
    vi.mocked(cacheGet).mockResolvedValueOnce(cachedProduct);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await getProductBySlug('cached');

    expect(result).not.toBeNull();
    expect(result!.id).toBe(10);
    // Should NOT call findUnique since we got cache hit
    expect(mockPrisma.product.findUnique).not.toHaveBeenCalled();
    // Should still increment view count
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { viewsCount: { increment: 1 } },
    });
  });
});
