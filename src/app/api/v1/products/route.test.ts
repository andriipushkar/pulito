import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/product', () => ({
  getProducts: vi.fn(),
}));

import { GET } from './route';
import { getProducts } from '@/services/product';

const mockedGetProducts = vi.mocked(getProducts);

describe('GET /api/v1/products', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated products on success', async () => {
    mockedGetProducts.mockResolvedValue({ products: [{ id: 1 }], total: 1 } as never);
    const req = new NextRequest('http://localhost/api/v1/products?page=1&limit=10');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([{ id: 1 }]);
  });

  it('returns 422 on invalid params', async () => {
    const req = new NextRequest('http://localhost/api/v1/products?page=-1');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('returns 500 on service error', async () => {
    mockedGetProducts.mockRejectedValue(new Error('DB error'));
    const req = new NextRequest('http://localhost/api/v1/products');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
