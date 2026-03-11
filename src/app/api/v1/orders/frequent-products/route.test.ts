import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { groupBy: vi.fn() },
    product: { findMany: vi.fn() },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockGroupBy = prisma.orderItem.groupBy as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.product.findMany as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/orders/frequent-products', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns frequent products', async () => {
    mockGroupBy.mockResolvedValue([
      { productId: 1, productName: 'P1', productCode: 'C1', _sum: { quantity: 10 }, _count: { id: 3 } },
    ]);
    mockFindMany.mockResolvedValue([{ id: 1, imagePath: '/img.jpg' }]);
    const req = new NextRequest('http://localhost/api/v1/orders/frequent-products');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].productId).toBe(1);
  });

  it('returns 500 on server error', async () => {
    mockGroupBy.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders/frequent-products');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('handles null productId and null quantity sum', async () => {
    mockGroupBy.mockResolvedValue([
      { productId: null, productName: 'P1', productCode: 'C1', _sum: { quantity: null }, _count: { id: 1 } },
    ]);
    mockFindMany.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/v1/orders/frequent-products');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].imagePath).toBe(null);
    expect(json.data[0].totalQuantity).toBe(0);
  });

  it('handles productId with no matching image', async () => {
    mockGroupBy.mockResolvedValue([
      { productId: 99, productName: 'P1', productCode: 'C1', _sum: { quantity: 5 }, _count: { id: 1 } },
    ]);
    mockFindMany.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/v1/orders/frequent-products');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].imagePath).toBe(null);
  });
});
