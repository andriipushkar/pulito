import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/category', () => ({ updateCategorySchema: { safeParse: vi.fn() } }));
vi.mock('@/services/category', () => ({
  getCategoryById: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  CategoryError: class CategoryError extends Error { statusCode = 400; },
}));

import { GET, PUT, DELETE } from './route';
import { getCategoryById, updateCategory, deleteCategory } from '@/services/category';
import { updateCategorySchema } from '@/validators/category';

const mockCtx = { params: Promise.resolve({ id: '1' }) };
const invalidCtx = { params: Promise.resolve({ id: 'abc' }) };

describe('GET /api/v1/admin/categories/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns category on success', async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: 1, name: 'Test' } as any);
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
    vi.mocked(getCategoryById).mockResolvedValue(null as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getCategoryById).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/categories/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates category on success', async () => {
    vi.mocked(updateCategorySchema.safeParse).mockReturnValue({ success: true, data: { name: 'Updated' } } as any);
    vi.mocked(updateCategory).mockResolvedValue({ id: 1 } as any);
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
    vi.mocked(updateCategorySchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'Bad' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(422);
  });

  it('uses fallback message when issues array is empty', async () => {
    vi.mocked(updateCategorySchema.safeParse).mockReturnValue({ success: false, error: { issues: [] } } as any);
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

  it('handles CategoryError', async () => {
    const { CategoryError } = await import('@/services/category');
    vi.mocked(updateCategorySchema.safeParse).mockReturnValue({ success: true, data: { name: 'Updated' } } as any);
    vi.mocked(updateCategory).mockRejectedValue(new (CategoryError as any)('Duplicate'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(updateCategorySchema.safeParse).mockReturnValue({ success: true, data: { name: 'Updated' } } as any);
    vi.mocked(updateCategory).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/categories/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes category on success', async () => {
    vi.mocked(deleteCategory).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('handles CategoryError', async () => {
    const { CategoryError } = await import('@/services/category');
    vi.mocked(deleteCategory).mockRejectedValue(new (CategoryError as any)('Has children'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(deleteCategory).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});
