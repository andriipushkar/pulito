import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    staticPage: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('@/utils/slug', () => ({
  createSlug: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, '-')),
}));

import { prisma } from '@/lib/prisma';
import { StaticPageError, getPublishedPages, getPageBySlug, getAllPages, createPage, updatePage, deletePage } from './static-page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublishedPages', () => {
  it('calls prisma with isPublished true', async () => {
    vi.mocked(prisma.staticPage.findMany).mockResolvedValue([]);

    await getPublishedPages();

    expect(prisma.staticPage.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      select: { id: true, slug: true, title: true, sortOrder: true, updatedAt: true },
      orderBy: { sortOrder: 'asc' },
    });
  });
});

describe('getAllPages', () => {
  it('calls prisma with orderBy sortOrder', async () => {
    vi.mocked(prisma.staticPage.findMany).mockResolvedValue([]);

    await getAllPages();

    expect(prisma.staticPage.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });
});

describe('getPageBySlug', () => {
  it('calls prisma with slug and isPublished', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue(null);

    await getPageBySlug('about');

    expect(prisma.staticPage.findUnique).toHaveBeenCalledWith({
      where: { slug: 'about', isPublished: true },
    });
  });
});

describe('createPage', () => {
  it('generates slug from title if not provided', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.staticPage.create).mockResolvedValue({ id: 1 } as any);

    await createPage({ title: 'My New Page', content: '<p>hello</p>' });

    expect(prisma.staticPage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: 'my-new-page' }),
    });
  });

  it('throws 409 if slug exists', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue({ id: 1 } as any);

    await expect(createPage({ title: 'Test', content: 'x' })).rejects.toThrow(StaticPageError);
    await expect(createPage({ title: 'Test', content: 'x' })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('updatePage', () => {
  it('throws 404 if page not found', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue(null);

    await expect(updatePage(999, { title: 'x' })).rejects.toThrow(StaticPageError);
    await expect(updatePage(999, { title: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 if new slug conflicts', async () => {
    vi.mocked(prisma.staticPage.findUnique)
      .mockResolvedValueOnce({ id: 1, slug: 'old-slug' } as any)   // page found
      .mockResolvedValueOnce({ id: 2, slug: 'taken-slug' } as any); // conflict

    await expect(updatePage(1, { slug: 'taken-slug' })).rejects.toThrow(StaticPageError);
  });

  it('updates page successfully', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue({ id: 1, slug: 'about' } as any);
    const updated = { id: 1, title: 'Updated', slug: 'about' };
    vi.mocked(prisma.staticPage.update).mockResolvedValue(updated as any);

    const result = await updatePage(1, { title: 'Updated' });

    expect(result).toEqual(updated);
    expect(prisma.staticPage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ title: 'Updated' }),
    });
  });

  it('updates page with all fields', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue({ id: 1, slug: 'about' } as any);
    vi.mocked(prisma.staticPage.update).mockResolvedValue({ id: 1 } as any);

    await updatePage(1, {
      title: 'New Title',
      content: '<p>new</p>',
      seoTitle: 'SEO Title',
      seoDescription: 'SEO Desc',
      isPublished: true,
      sortOrder: 5,
      updatedBy: 2,
    });

    expect(prisma.staticPage.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        title: 'New Title',
        content: '<p>new</p>',
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Desc',
        isPublished: true,
        sortOrder: 5,
        updatedBy: 2,
      },
    });
  });

  it('updates page with new slug when no conflict', async () => {
    vi.mocked(prisma.staticPage.findUnique)
      .mockResolvedValueOnce({ id: 1, slug: 'old-slug' } as any)
      .mockResolvedValueOnce(null); // no conflict
    vi.mocked(prisma.staticPage.update).mockResolvedValue({ id: 1, slug: 'new-slug' } as any);

    const result = await updatePage(1, { slug: 'new-slug' });

    expect(result).toEqual({ id: 1, slug: 'new-slug' });
  });
});

describe('deletePage', () => {
  it('throws 404 if page not found', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue(null);

    await expect(deletePage(999)).rejects.toThrow(StaticPageError);
    await expect(deletePage(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('deletes page successfully', async () => {
    vi.mocked(prisma.staticPage.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.staticPage.delete).mockResolvedValue({ id: 1 } as any);

    await deletePage(1);

    expect(prisma.staticPage.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
