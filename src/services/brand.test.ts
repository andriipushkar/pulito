import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBrands,
  getBrandBySlug,
  createBrand,
  updateBrand,
  deleteBrand,
  BrandError,
} from './brand';
import { Prisma } from '@/../generated/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    brand: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    product: {
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('@/services/cache', () => ({
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/slug', () => ({
  createSlug: vi.fn((text: string) =>
    text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  ),
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBrands', () => {
  it('filters out soft-deleted', async () => {
    mockPrisma.brand.findMany.mockResolvedValue([{ id: 1, name: 'A' }]);
    await getBrands();
    expect(mockPrisma.brand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null, isVisible: true }),
      }),
    );
  });

  it('includeHidden=true keeps isVisible:false brands', async () => {
    mockPrisma.brand.findMany.mockResolvedValue([]);
    await getBrands({ includeHidden: true });
    const args = mockPrisma.brand.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ deletedAt: null });
    expect(args.where.isVisible).toBeUndefined();
  });
});

describe('getBrandBySlug', () => {
  it('only returns visible, non-deleted brands', async () => {
    mockPrisma.brand.findFirst.mockResolvedValue(null);
    await getBrandBySlug('foo');
    expect(mockPrisma.brand.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'foo', deletedAt: null, isVisible: true },
      }),
    );
  });
});

describe('createBrand', () => {
  it('auto-generates slug from name when omitted', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(null);
    mockPrisma.brand.create.mockResolvedValue({ id: 1, slug: 'procter-gamble' });

    await createBrand({ name: 'Procter Gamble' });
    expect(mockPrisma.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'procter-gamble' }) }),
    );
  });

  it('respects user-provided slug', async () => {
    mockPrisma.brand.findUnique.mockResolvedValue(null);
    mockPrisma.brand.create.mockResolvedValue({ id: 1 });
    await createBrand({ name: 'Whatever', slug: 'custom-slug' });
    expect(mockPrisma.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'custom-slug' }) }),
    );
  });

  it('resurrects a soft-deleted row with the same slug instead of 409', async () => {
    // First findUnique: slug clash returns a soft-deleted row
    mockPrisma.brand.findUnique
      .mockResolvedValueOnce({ id: 9, slug: 'ariel', deletedAt: new Date() })
      // Second findUnique (by name) — not reached
      .mockResolvedValueOnce(null);
    mockPrisma.brand.update.mockResolvedValue({ id: 9, slug: 'ariel', deletedAt: null });

    const result = await createBrand({ name: 'Ariel', slug: 'ariel' });
    expect(mockPrisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9 },
        data: expect.objectContaining({ deletedAt: null, name: 'Ariel' }),
      }),
    );
    expect(mockPrisma.brand.create).not.toHaveBeenCalled();
    expect((result as { id: number }).id).toBe(9);
  });

  it('throws 409 when an active row holds the slug', async () => {
    mockPrisma.brand.findUnique.mockResolvedValueOnce({
      id: 5,
      slug: 'ariel',
      deletedAt: null,
    });
    await expect(createBrand({ name: 'Ariel', slug: 'ariel' })).rejects.toBeInstanceOf(BrandError);
  });
});

describe('updateBrand', () => {
  it('regenerates slug when name changes and client echoes back the current slug', async () => {
    mockPrisma.brand.findFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Old Name',
      slug: 'old-name',
      deletedAt: null,
    });
    // No conflict on new slug
    mockPrisma.brand.findFirst.mockResolvedValueOnce(null);
    mockPrisma.brand.update.mockResolvedValue({ id: 1, slug: 'new-name' });

    await updateBrand(1, { name: 'New Name', slug: 'old-name' });
    expect(mockPrisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'new-name' }) }),
    );
  });

  it('uses explicit slug when client sends a *different* slug', async () => {
    mockPrisma.brand.findFirst.mockResolvedValueOnce({
      id: 1,
      name: 'Same',
      slug: 'same',
      deletedAt: null,
    });
    mockPrisma.brand.findFirst.mockResolvedValueOnce(null);
    mockPrisma.brand.update.mockResolvedValue({ id: 1 });

    await updateBrand(1, { slug: 'custom-override' });
    expect(mockPrisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'custom-override' }) }),
    );
  });
});

describe('deleteBrand', () => {
  it('hard-deletes when no FK conflict', async () => {
    mockPrisma.brand.findFirst.mockResolvedValue({ id: 1, deletedAt: null });
    mockPrisma.brand.delete.mockResolvedValue({ id: 1 });
    const res = await deleteBrand(1);
    expect(res).toEqual({ hard: true, affectedProducts: 0 });
    expect(mockPrisma.brand.update).not.toHaveBeenCalled();
  });

  it('falls back to soft-delete on P2003 FK constraint', async () => {
    mockPrisma.brand.findFirst.mockResolvedValue({ id: 1, deletedAt: null });
    const fkErr = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: 'test',
    });
    mockPrisma.brand.delete.mockRejectedValue(fkErr);
    mockPrisma.brand.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

    const res = await deleteBrand(1);
    expect(res).toEqual({ hard: false, affectedProducts: 0 });
    expect(mockPrisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date), isVisible: false }),
      }),
    );
  });

  it('rethrows non-P2003 errors', async () => {
    mockPrisma.brand.findFirst.mockResolvedValue({ id: 1, deletedAt: null });
    mockPrisma.brand.delete.mockRejectedValue(new Error('boom'));
    await expect(deleteBrand(1)).rejects.toThrow('boom');
  });
});
