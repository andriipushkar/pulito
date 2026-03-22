import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import { getCategories, getCategoryBySlug, getCategoryById, createCategory, updateCategory, deleteCategory, CategoryError } from './category';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(3),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    slugRedirect: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/services/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
  CACHE_TTL: { LONG: 3600 },
}));

vi.mock('@/utils/slug', () => ({
  createSlug: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, '-')),
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCategories', () => {
  it('should return only visible categories by default', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);
    await getCategories();
    const call = mockPrisma.category.findMany.mock.calls[0][0];
    expect(call.where).toEqual(expect.objectContaining({ isVisible: true }));
  });

  it('should include hidden categories when includeHidden is true', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);
    await getCategories({ includeHidden: true });
    const call = mockPrisma.category.findMany.mock.calls[0][0];
    expect(call.where.isVisible).toBeUndefined();
  });
});

describe('getCategoryBySlug', () => {
  it('should return category by slug', async () => {
    const mockCategory = { id: 1, name: 'Test', slug: 'test', _count: { products: 5 } };
    mockPrisma.category.findUnique.mockResolvedValue(mockCategory as never);
    const result = await getCategoryBySlug('test');
    expect(result).toEqual(mockCategory);
  });

  it('should return null for non-existent slug', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const result = await getCategoryBySlug('nonexistent');
    expect(result).toBeNull();
  });
});

describe('createCategory', () => {
  it('should create a category with auto-generated slug', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const created = { id: 1, name: 'Пральні засоби', slug: 'pralni-zasoby' };
    mockPrisma.category.create.mockResolvedValue(created as never);

    await createCategory({ name: 'Пральні засоби' });
    expect(mockPrisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Пральні засоби' }),
      })
    );
  });

  it('should throw 409 if slug already exists', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1 } as never);
    await expect(createCategory({ name: 'Test' })).rejects.toThrow(CategoryError);
  });

  it('should throw 404 if parent category not found', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce(null) // slug check
      .mockResolvedValueOnce(null); // parent check
    await expect(createCategory({ name: 'Test', parentId: 999 })).rejects.toThrow(CategoryError);
  });
});

describe('updateCategory', () => {
  it('should throw 404 if category not found', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    await expect(updateCategory(999, { name: 'New Name' })).rejects.toThrow(CategoryError);
  });

  it('should throw 400 if category is its own parent', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, slug: 'test' } as never);
    await expect(updateCategory(1, { parentId: 1 })).rejects.toThrow(CategoryError);
  });
});

describe('deleteCategory', () => {
  it('should throw 404 if category not found', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    await expect(deleteCategory(999)).rejects.toThrow(CategoryError);
  });

  it('should throw 400 if category has products', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: 1,
      _count: { products: 5 },
    } as never);
    await expect(deleteCategory(1)).rejects.toThrow(CategoryError);
  });

  it('should delete category with no products', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: 1,
      _count: { products: 0 },
    } as never);
    mockPrisma.category.delete.mockResolvedValue({} as never);
    // Also mock updateMany for soft delete if used
    mockPrisma.category.updateMany?.mockResolvedValue?.({} as never);
    (mockPrisma.category as any).update?.mockResolvedValue?.({} as never);
    await deleteCategory(1);
    // Verify category was deleted or soft-deleted
    const deleted = mockPrisma.category.delete.mock.calls.length > 0;
    const softDeleted = (mockPrisma.category as any).update?.mock?.calls?.length > 0;
    expect(deleted || softDeleted).toBe(true);
  });
});

describe('getCategoryById', () => {
  it('should return category by id', async () => {
    const mockCategory = { id: 1, name: 'Test', slug: 'test', _count: { products: 5 } };
    mockPrisma.category.findUnique.mockResolvedValue(mockCategory as never);
    const result = await getCategoryById(1);
    expect(result).toEqual(mockCategory);
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
  });

  it('should return null for non-existent id', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const result = await getCategoryById(999);
    expect(result).toBeNull();
  });
});

describe('createCategory - additional', () => {
  it('should create with explicit slug', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);
    const created = { id: 1, name: 'Test', slug: 'custom-slug' };
    mockPrisma.category.create.mockResolvedValue(created as never);

    await createCategory({ name: 'Test', slug: 'custom-slug' });
    expect(mockPrisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'custom-slug' }),
      })
    );
  });

  it('should create with valid parentId', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce(null) // slug check
      .mockResolvedValueOnce({ id: 5 } as never); // parent check
    const created = { id: 2, name: 'Child', slug: 'child', parentId: 5 };
    mockPrisma.category.create.mockResolvedValue(created as never);

    await createCategory({ name: 'Child', parentId: 5 });
    expect(mockPrisma.category.create).toHaveBeenCalled();
  });
});

describe('updateCategory - additional', () => {
  it('should auto-generate slug from name when slug not provided', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce({ id: 1, slug: 'old-slug' } as never) // category lookup
      .mockResolvedValueOnce(null as never); // slug uniqueness check
    (prisma as unknown as MockPrismaClient).slugRedirect = { upsert: vi.fn().mockResolvedValue({} as never) } as never;
    mockPrisma.category.update.mockResolvedValue({ id: 1, slug: 'new-name' } as never);

    await updateCategory(1, { name: 'New Name' });
    expect(mockPrisma.category.update).toHaveBeenCalled();
  });

  it('should throw 409 when new slug conflicts with existing category', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce({ id: 1, slug: 'old-slug' } as never) // category lookup
      .mockResolvedValueOnce({ id: 2, slug: 'existing' } as never); // slug conflict

    await expect(updateCategory(1, { slug: 'existing' })).rejects.toThrow(CategoryError);
  });

  it('should throw 404 when parentId does not exist', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce({ id: 1, slug: 'test' } as never) // category lookup
      .mockResolvedValueOnce(null as never); // parent lookup

    await expect(updateCategory(1, { parentId: 999 })).rejects.toThrow(CategoryError);
  });

  it('should update without slug change when name not provided', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, slug: 'test' } as never);
    mockPrisma.category.update.mockResolvedValue({ id: 1, slug: 'test', description: 'updated' } as never);

    await updateCategory(1, { description: 'updated' });
    expect(mockPrisma.category.update).toHaveBeenCalled();
  });
});

describe('CategoryError', () => {
  it('should create error with correct properties', () => {
    const error = new CategoryError('test message', 400);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('test message');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('CategoryError');
  });
});

describe('updateCategory - parentId not found', () => {
  it('should throw 404 when parentId category does not exist (not self-referential)', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce({ id: 1, slug: 'test' } as never) // category lookup
      .mockResolvedValueOnce(null as never); // parent lookup fails

    await expect(updateCategory(1, { parentId: 999 })).rejects.toThrow(CategoryError);
  });

  it('should update with valid parentId successfully', async () => {
    mockPrisma.category.findUnique
      .mockResolvedValueOnce({ id: 1, slug: 'test' } as never) // category lookup
      .mockResolvedValueOnce({ id: 5 } as never); // parent found
    mockPrisma.category.update.mockResolvedValue({ id: 1, parentId: 5 } as never);

    await updateCategory(1, { parentId: 5 });
    expect(mockPrisma.category.update).toHaveBeenCalled();
  });

  it('should update all optional fields including iconPath, coverImage, seoTitle, seoDescription, sortOrder, isVisible', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, slug: 'test' } as never);
    mockPrisma.category.update.mockResolvedValue({ id: 1 } as never);

    await updateCategory(1, {
      iconPath: '/icon.png',
      coverImage: '/cover.jpg',
      seoTitle: 'SEO Title',
      seoDescription: 'SEO Desc',
      sortOrder: 5,
      isVisible: false,
    });

    expect(mockPrisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          iconPath: '/icon.png',
          coverImage: '/cover.jpg',
          seoTitle: 'SEO Title',
          seoDescription: 'SEO Desc',
          sortOrder: 5,
          isVisible: false,
        }),
      })
    );
  });

  it('should allow setting parentId to null (clearing parent)', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 1, slug: 'test' } as never);
    mockPrisma.category.update.mockResolvedValue({ id: 1, parentId: null } as never);

    await updateCategory(1, { parentId: null });

    expect(mockPrisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: null,
        }),
      })
    );
  });
});

describe('getCategories - cache hit', () => {
  it('should return cached categories when available', async () => {
    const { cacheGet } = await import('@/services/cache');
    const cached = [{ id: 1, name: 'Cached' }];
    vi.mocked(cacheGet).mockResolvedValueOnce(cached as never);

    const result = await getCategories();
    expect(result).toEqual(cached);
    expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
  });
});
