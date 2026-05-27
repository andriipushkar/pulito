import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));
vi.mock('@/services/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({ site_name: 'Pulito' }),
}));
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 60, retryAfter: 0 }),
  RATE_LIMITS: { publicFeed: { prefix: 'rl:feed:', max: 60, windowSec: 60 } },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

function fakeReq() {
  return { headers: { get: () => null } } as any;
}

describe('GET /feed.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns RSS feed on success', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        name: 'Test',
        slug: 'test',
        priceRetail: 100,
        createdAt: new Date(),
        categoryId: 1,
        content: { shortDescription: 'Desc' },
        category: { name: 'Cat' },
      },
    ] as any);
    const res = await GET(fakeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml');
  });

  it('returns empty RSS on no products', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    const res = await GET(fakeReq());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<rss');
  });

  it('handles product with null content and null category', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        name: 'Test',
        slug: 'test',
        priceRetail: 100,
        createdAt: new Date(),
        categoryId: null,
        content: null,
        category: null,
      },
    ] as any);
    const res = await GET(fakeReq());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Test');
    expect(text).toContain('<category></category>');
  });

  it('escapes < > & in category and CDATA-escapes name', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        name: 'Soap]]>Trick',
        slug: 'soap',
        priceRetail: 1,
        createdAt: new Date(),
        categoryId: 1,
        content: null,
        category: { name: 'Bath & Body <strong>' },
      },
    ] as any);
    const res = await GET(fakeReq());
    const text = await res.text();
    expect(text).toContain('Bath &amp; Body &lt;strong&gt;');
    expect(text).not.toMatch(/Soap]]>Trick\]\]>/);
  });

  it('returns 429 when rate-limited', async () => {
    const { checkRateLimit } = await import('@/services/rate-limit');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 60,
    });
    const res = await GET(fakeReq());
    expect(res.status).toBe(429);
  });
});
