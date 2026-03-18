import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/product', () => ({ updateProductSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/product', () => ({
  getProductById: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  ProductError: class ProductError extends Error { statusCode = 400; },
}));

import { GET, PUT, DELETE } from './route';
import { getProductById, updateProduct, deleteProduct } from '@/services/product';
import { updateProductSchema } from '@/validators/product';

const mockCtx = { params: Promise.resolve({ id: '1' }) };
const invalidCtx = { params: Promise.resolve({ id: 'abc' }) };

describe('GET /api/v1/admin/products/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns product on success', async () => {
    vi.mocked(getProductById).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    vi.mocked(getProductById).mockResolvedValue(null as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getProductById).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/products/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates product on success', async () => {
    vi.mocked(updateProductSchema.safeParse).mockReturnValue({ success: true, data: { name: 'Updated' } } as any);
    vi.mocked(updateProduct).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on validation error', async () => {
    vi.mocked(updateProductSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'Bad' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('uses fallback message when issues array is empty', async () => {
    vi.mocked(updateProductSchema.safeParse).mockReturnValue({ success: false, error: { issues: [] } } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Невалідні дані');
  });

  it('handles ProductError', async () => {
    const { ProductError } = await import('@/services/product');
    vi.mocked(updateProductSchema.safeParse).mockReturnValue({ success: true, data: { name: 'Updated' } } as any);
    vi.mocked(updateProduct).mockRejectedValue(new (ProductError as any)('Duplicate'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(updateProductSchema.safeParse).mockReturnValue({ success: true, data: { name: 'Updated' } } as any);
    vi.mocked(updateProduct).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/products/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes product on success', async () => {
    vi.mocked(deleteProduct).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('handles ProductError', async () => {
    const { ProductError } = await import('@/services/product');
    vi.mocked(deleteProduct).mockRejectedValue(new (ProductError as any)('In use'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(deleteProduct).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
