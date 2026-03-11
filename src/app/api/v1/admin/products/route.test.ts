import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/product', () => ({ createProductSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/product', () => ({
  createProduct: vi.fn(),
  ProductError: class ProductError extends Error { statusCode = 400; },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';
import { createProduct } from '@/services/product';
import { createProductSchema } from '@/validators/product';

describe('GET /api/v1/admin/products', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns products on success', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);
    const req = new NextRequest('http://localhost/api/v1/admin/products?page=1&limit=20');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('applies search filter', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(0);
    const req = new NextRequest('http://localhost/api/v1/admin/products?search=test');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.product.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.product.findMany).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/products');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/products', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates product on success', async () => {
    vi.mocked(createProductSchema.safeParse).mockReturnValue({ success: true, data: { name: 'Test', code: 'T1' } } as any);
    vi.mocked(createProduct).mockResolvedValue({ id: 1 } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', code: 'T1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    vi.mocked(createProductSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'Required' }] } } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('uses fallback message when issues array is empty', async () => {
    vi.mocked(createProductSchema.safeParse).mockReturnValue({ success: false, error: { issues: [] } } as any);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Невалідні дані');
  });

  it('handles ProductError', async () => {
    const { ProductError } = await import('@/services/product');
    vi.mocked(createProductSchema.safeParse).mockReturnValue({ success: true, data: { name: 'Test', code: 'T1' } } as any);
    vi.mocked(createProduct).mockRejectedValue(new ProductError('Duplicate code'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', code: 'T1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createProductSchema.safeParse).mockReturnValue({ success: true, data: { name: 'Test', code: 'T1' } } as any);
    vi.mocked(createProduct).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', code: 'T1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
