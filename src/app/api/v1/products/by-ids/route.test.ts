import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockFindMany = prisma.product.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/v1/products/by-ids', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 without ids param', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/by-ids');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('returns empty array for invalid ids', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/by-ids?ids=abc,xyz');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns products by ids', async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, code: 'P1', name: 'Product 1', slug: 'p1', priceRetail: 100, priceWholesale: null, priceWholesale2: null, priceWholesale3: null, priceRetailOld: null, priceWholesaleOld: null, quantity: 10, isPromo: false, isActive: true, imagePath: null, viewsCount: 0, ordersCount: 0, createdAt: new Date(), category: null, badges: [], images: [], content: null },
    ]);
    const req = new NextRequest('http://localhost/api/v1/products/by-ids?ids=1,2');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].priceRetail).toBe(100);
  });

  it('returns 500 on error', async () => {
    mockFindMany.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/by-ids?ids=1');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
