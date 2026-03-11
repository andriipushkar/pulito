import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findUnique: vi.fn() },
    priceHistory: { findMany: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockedProductFindUnique = vi.mocked(prisma.product.findUnique);
const mockedPriceHistoryFindMany = vi.mocked(prisma.priceHistory.findMany);

describe('GET /api/v1/products/[slug]/price-history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns price history on success', async () => {
    mockedProductFindUnique.mockResolvedValue({ id: 1 } as never);
    mockedPriceHistoryFindMany.mockResolvedValue([{ id: 1, priceRetailNew: 100 }] as never);
    const req = new NextRequest('http://localhost/api/v1/products/test/price-history');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test' }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 404 when product not found', async () => {
    mockedProductFindUnique.mockResolvedValue(null as never);
    const req = new NextRequest('http://localhost/api/v1/products/missing/price-history');
    const res = await GET(req, { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    mockedProductFindUnique.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/err/price-history');
    const res = await GET(req, { params: Promise.resolve({ slug: 'err' }) });
    expect(res.status).toBe(500);
  });
});
