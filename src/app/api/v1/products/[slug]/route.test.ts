import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withOptionalAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args),
}));

vi.mock('@/services/product', () => ({
  getProductBySlug: vi.fn(),
}));

import { GET } from './route';
import { getProductBySlug } from '@/services/product';

const mockedGetProductBySlug = vi.mocked(getProductBySlug);

describe('GET /api/v1/products/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns product on success', async () => {
    mockedGetProductBySlug.mockResolvedValue({ id: 1, name: 'Test' } as never);
    const req = new NextRequest('http://localhost/api/v1/products/test-slug');
    const res = await GET(req, { user: null, params: Promise.resolve({ slug: 'test-slug' }) } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 404 when product not found', async () => {
    mockedGetProductBySlug.mockResolvedValue(null as never);
    const req = new NextRequest('http://localhost/api/v1/products/missing');
    const res = await GET(req, { user: null, params: Promise.resolve({ slug: 'missing' }) } as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on service error', async () => {
    mockedGetProductBySlug.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/err');
    const res = await GET(req, { user: null, params: Promise.resolve({ slug: 'err' }) } as any);
    expect(res.status).toBe(500);
  });
});
