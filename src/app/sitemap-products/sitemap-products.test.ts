import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from './[chunk]/route';
import { prisma } from '@/lib/prisma';

describe('sitemap-products chunk route', () => {
  it('returns XML with products for valid chunk', async () => {
    (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'product-1', updatedAt: new Date('2025-06-01') },
      { slug: 'product-2', updatedAt: new Date('2025-06-02') },
    ]);

    const response = await GET(
      new Request('http://localhost:3000/sitemap-products/0'),
      { params: Promise.resolve({ chunk: '0' }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml');

    const xml = await response.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('/product/product-1');
    expect(xml).toContain('/product/product-2');
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('returns 404 for empty chunk', async () => {
    (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const response = await GET(
      new Request('http://localhost:3000/sitemap-products/999'),
      { params: Promise.resolve({ chunk: '999' }) }
    );

    expect(response.status).toBe(404);
  });

  it('returns 404 for invalid chunk', async () => {
    const response = await GET(
      new Request('http://localhost:3000/sitemap-products/abc'),
      { params: Promise.resolve({ chunk: 'abc' }) }
    );

    expect(response.status).toBe(404);
  });

  it('returns 404 for negative chunk', async () => {
    const response = await GET(
      new Request('http://localhost:3000/sitemap-products/-1'),
      { params: Promise.resolve({ chunk: '-1' }) }
    );

    expect(response.status).toBe(404);
  });

  it('sets cache headers', async () => {
    (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'p', updatedAt: new Date() },
    ]);

    const response = await GET(
      new Request('http://localhost:3000/sitemap-products/0'),
      { params: Promise.resolve({ chunk: '0' }) }
    );

    expect(response.headers.get('Cache-Control')).toContain('public');
  });

  it('uses pagination with skip/take', async () => {
    (prisma.product.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'p', updatedAt: new Date() },
    ]);

    await GET(
      new Request('http://localhost:3000/sitemap-products/2'),
      { params: Promise.resolve({ chunk: '2' }) }
    );

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10000, // chunk 2 * 5000
        take: 5000,
      })
    );
  });
});
