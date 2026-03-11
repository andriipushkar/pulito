import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /feed.xml', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns RSS feed on success', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { name: 'Test', slug: 'test', priceRetail: 100, createdAt: new Date(), categoryId: 1, content: { shortDescription: 'Desc' }, category: { name: 'Cat' } },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml');
  });

  it('returns empty RSS on no products', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<rss');
  });

  it('handles product with null content and null category', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { name: 'Test', slug: 'test', priceRetail: 100, createdAt: new Date(), categoryId: null, content: null, category: null },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Test');
    expect(text).toContain('<category></category>');
  });
});
