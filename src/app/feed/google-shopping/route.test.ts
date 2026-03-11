import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /feed/google-shopping', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns Google Shopping feed on success', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 1, code: 'A1', name: 'Test', slug: 'test', priceRetail: 100, priceRetailOld: null, quantity: 10, isPromo: false, imagePath: '/img.jpg', updatedAt: new Date(), content: { shortDescription: 'Desc' }, category: { name: 'Cat', slug: 'cat', parent: null }, images: [] },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
  });

  it('returns empty feed on no products', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<rss');
  });

  it('handles product with sale price (priceRetailOld > priceRetail)', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 2, code: 'B1', name: 'Sale Item', slug: 'sale', priceRetail: 80, priceRetailOld: 120, quantity: 5, isPromo: true, imagePath: null, updatedAt: new Date(), content: null, category: { name: 'Cat', slug: 'cat', parent: { name: 'Parent' } }, images: [{ pathFull: '/img/sale.jpg' }] },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('g:sale_price');
    expect(text).toContain('Parent &gt; Cat');
  });

  it('handles product with no images and no imagePath', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 3, code: 'C1', name: 'No Image', slug: 'no-img', priceRetail: 50, priceRetailOld: null, quantity: 1, isPromo: false, imagePath: null, updatedAt: new Date(), content: { shortDescription: 'Desc' }, category: null, images: [] },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    // No image_link should be present
    expect(text).not.toContain('g:image_link');
    // Default product type
    expect(text).toContain('Побутова хімія');
  });

  it('handles product with absolute image URL', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 4, code: 'D1', name: 'Abs Img', slug: 'abs-img', priceRetail: 60, priceRetailOld: 60, quantity: 3, isPromo: false, imagePath: 'https://cdn.example.com/img.jpg', updatedAt: new Date(), content: null, category: { name: 'Cat', slug: 'cat', parent: null }, images: [] },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('https://cdn.example.com/img.jpg');
    // priceRetailOld === priceRetail, so no sale_price
    expect(text).not.toContain('g:sale_price');
  });

  it('handles product with only category name (no parent)', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 5, code: 'E1', name: 'Cat Only', slug: 'cat-only', priceRetail: 70, priceRetailOld: null, quantity: 2, isPromo: false, imagePath: '/img.jpg', updatedAt: new Date(), content: null, category: { name: 'Single', slug: 'single', parent: null }, images: [] },
    ] as any);
    const res = await GET();
    const text = await res.text();
    expect(text).toContain('Single');
  });
});
