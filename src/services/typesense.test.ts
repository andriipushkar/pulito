import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

const mockTypesenseDocuments = vi.hoisted(() => ({
  search: vi.fn(),
  upsert: vi.fn(),
  import: vi.fn(),
  delete: vi.fn(),
}));

const mockTypesenseSynonyms = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

const mockTypesenseCollection = vi.hoisted(() => ({
  retrieve: vi.fn(),
  update: vi.fn(),
  documents: vi.fn(() => mockTypesenseDocuments),
  synonyms: vi.fn(() => mockTypesenseSynonyms),
}));

const mockCollectionsCreate = vi.hoisted(() => vi.fn());

const mockTypesenseCollections = vi.hoisted(() => {
  const fn = vi.fn((name?: string) => {
    if (name) return mockTypesenseCollection;
    return { create: mockCollectionsCreate };
  });
  return fn;
});

const mockTypesenseHealth = vi.hoisted(() => ({
  retrieve: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/config/env', () => ({
  env: {
    TYPESENSE_HOST: 'localhost',
    TYPESENSE_PORT: 8108,
    TYPESENSE_PROTOCOL: 'http',
    TYPESENSE_API_KEY: 'test-key',
  },
}));

vi.mock('typesense', () => ({
  default: {
    Client: class MockClient {
      collections: unknown;
      health: unknown;
      constructor() {
        this.collections = mockTypesenseCollections;
        this.health = mockTypesenseHealth;
      }
    },
  },
}));

// Need to also set up the `documents(id).delete()` pattern
const mockDocumentInstance = vi.hoisted(() => ({
  delete: vi.fn(),
}));

import {
  ensureCollection,
  indexAllProducts,
  indexProduct,
  searchProducts,
  autocomplete,
  isTypesenseAvailable,
} from './typesense';

beforeEach(() => {
  vi.clearAllMocks();
  mockTypesenseCollection.retrieve.mockResolvedValue({});
  mockTypesenseCollection.update.mockResolvedValue({});
  mockTypesenseDocuments.search.mockResolvedValue({ hits: [], found: 0, page: 1 });
  mockTypesenseDocuments.upsert.mockResolvedValue({});
  mockTypesenseDocuments.import.mockResolvedValue([]);
  // Set up documents(id) to return an object with delete()
  (mockTypesenseCollection.documents as any).mockImplementation((id?: string) => {
    if (id) return mockDocumentInstance;
    return mockTypesenseDocuments;
  });
});

describe('ensureCollection', () => {
  it('should not create collection if it already exists', async () => {
    mockTypesenseCollection.retrieve.mockResolvedValue({ name: 'products' });

    await ensureCollection();

    expect(mockTypesenseCollection.retrieve).toHaveBeenCalled();
    expect(mockCollectionsCreate).not.toHaveBeenCalled();
  });

  it('should create collection if it does not exist', async () => {
    mockTypesenseCollection.retrieve.mockRejectedValue(new Error('Not found'));

    await ensureCollection();

    expect(mockCollectionsCreate).toHaveBeenCalled();
  });
});

describe('indexProduct', () => {
  const mockProduct = {
    id: 1,
    name: 'Порошок Ariel',
    code: 'ARI-001',
    slug: 'poroshok-ariel',
    priceRetail: 159.99,
    quantity: 50,
    isActive: true,
    isPromo: false,
    ordersCount: 120,
    imagePath: '/uploads/products/ari-001/thumb.webp',
    category: { name: 'Порошки', slug: 'poroshky' },
  };

  it('should index an active product', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

    await indexProduct(1);

    expect(mockTypesenseDocuments.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        name: 'Порошок Ariel',
        code: 'ARI-001',
        priceRetail: 159.99,
        isActive: true,
        categoryName: 'Порошки',
      }),
    );
  });

  it('should remove inactive product from index', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, isActive: false });

    await indexProduct(1);

    expect(mockDocumentInstance.delete).toHaveBeenCalled();
    expect(mockTypesenseDocuments.upsert).not.toHaveBeenCalled();
  });

  it('should silently return when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await indexProduct(999);

    expect(mockTypesenseDocuments.upsert).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should log error on typesense failure', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
    mockTypesenseDocuments.upsert.mockRejectedValue(new Error('Connection refused'));

    await indexProduct(1);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Typesense index error',
      expect.objectContaining({ productId: 1 }),
    );
  });

  it('should handle product without category', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, category: null });

    await indexProduct(1);

    expect(mockTypesenseDocuments.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryName: '',
        categorySlug: '',
      }),
    );
  });

  it('should handle product without imagePath', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, imagePath: null });

    await indexProduct(1);

    expect(mockTypesenseDocuments.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ imagePath: '' }),
    );
  });
});

describe('indexAllProducts', () => {
  it('should index all active products in batches', async () => {
    const products = Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      name: `Product ${i}`,
      code: `P-${i}`,
      slug: `product-${i}`,
      priceRetail: 100 + i,
      quantity: 10,
      isActive: true,
      isPromo: false,
      ordersCount: i,
      imagePath: null,
      category: { name: 'Cat', slug: 'cat' },
    }));
    mockPrisma.product.findMany.mockResolvedValue(products);

    const result = await indexAllProducts();

    expect(result.indexed).toBe(150);
    // 150 products / 100 batch = 2 imports
    expect(mockTypesenseDocuments.import).toHaveBeenCalledTimes(2);
  });

  it('should return 0 indexed when no products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    const result = await indexAllProducts();

    expect(result.indexed).toBe(0);
  });
});

describe('searchProducts', () => {
  it('should search with default params', async () => {
    mockTypesenseDocuments.search.mockResolvedValue({
      hits: [
        {
          document: { id: '1', name: 'Ariel', code: 'A-1' },
          highlights: [{ field: 'name' }],
        },
      ],
      found: 1,
      page: 1,
    });

    const result = await searchProducts('ariel');

    expect(result).not.toBeNull();
    expect(result!.hits).toHaveLength(1);
    expect(result!.hits[0]).toMatchObject({ id: 1, name: 'Ariel' });
    expect(result!.total).toBe(1);
  });

  it('should apply custom filters and sorting', async () => {
    mockTypesenseDocuments.search.mockResolvedValue({ hits: [], found: 0, page: 1 });

    await searchProducts('порошок', {
      page: 2,
      limit: 10,
      filterBy: 'isActive:true && isPromo:true',
      sortBy: 'priceRetail:asc',
    });

    expect(mockTypesenseDocuments.search).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'порошок',
        filter_by: 'isActive:true && isPromo:true',
        sort_by: 'priceRetail:asc',
        page: 2,
        per_page: 10,
      }),
    );
  });

  it('should return null on search error (fallback to DB)', async () => {
    mockTypesenseDocuments.search.mockRejectedValue(new Error('Connection refused'));

    const result = await searchProducts('test');

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle empty results', async () => {
    mockTypesenseDocuments.search.mockResolvedValue({ hits: [], found: 0, page: 1 });

    const result = await searchProducts('nonexistent-product-xyz');

    expect(result).not.toBeNull();
    expect(result!.hits).toEqual([]);
    expect(result!.total).toBe(0);
  });

  it('should handle special characters in query', async () => {
    mockTypesenseDocuments.search.mockResolvedValue({ hits: [], found: 0, page: 1 });

    await searchProducts('порошок "Ariel" 3-в-1');

    expect(mockTypesenseDocuments.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'порошок "Ariel" 3-в-1' }),
    );
  });
});

describe('autocomplete', () => {
  it('should return simplified results for autocomplete', async () => {
    mockTypesenseDocuments.search.mockResolvedValue({
      hits: [
        {
          document: {
            id: '5',
            name: 'Fairy Original',
            code: 'FAI-001',
            slug: 'fairy-original',
            priceRetail: 89.5,
            imagePath: '/img.webp',
            categoryName: 'Для посуду',
          },
          highlights: [],
        },
      ],
      found: 1,
      page: 1,
    });

    const result = await autocomplete('fairy');

    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0]).toEqual({
      id: 5,
      name: 'Fairy Original',
      code: 'FAI-001',
      slug: 'fairy-original',
      priceRetail: 89.5,
      imagePath: '/img.webp',
      categoryName: 'Для посуду',
    });
  });

  it('should return null on error', async () => {
    mockTypesenseDocuments.search.mockRejectedValue(new Error('fail'));

    const result = await autocomplete('test');
    expect(result).toBeNull();
  });

  it('should respect custom limit', async () => {
    mockTypesenseDocuments.search.mockResolvedValue({ hits: [], found: 0, page: 1 });

    await autocomplete('test', 5);

    expect(mockTypesenseDocuments.search).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 5 }),
    );
  });
});

describe('isTypesenseAvailable', () => {
  it('should return true when health check succeeds', async () => {
    mockTypesenseHealth.retrieve.mockResolvedValue({ ok: true });

    const result = await isTypesenseAvailable();
    expect(result).toBe(true);
  });

  it('should return false when health check fails', async () => {
    mockTypesenseHealth.retrieve.mockRejectedValue(new Error('Connection refused'));

    const result = await isTypesenseAvailable();
    expect(result).toBe(false);
  });
});
