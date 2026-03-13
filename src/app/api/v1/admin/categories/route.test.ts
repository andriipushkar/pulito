import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/category', () => ({ createCategorySchema: { safeParse: vi.fn() } }));
vi.mock('@/services/category', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  CategoryError: class CategoryError extends Error { statusCode = 400; },
}));

import { GET, POST } from './route';
import { getCategories, createCategory } from '@/services/category';
import { createCategorySchema } from '@/validators/category';

describe('GET /api/v1/admin/categories', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns categories on success', async () => {
    vi.mocked(getCategories).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getCategories).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/categories', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates category on success', async () => {
    vi.mocked(createCategorySchema.safeParse).mockReturnValue({ success: true, data: { name: 'Test' } } as any);
    vi.mocked(createCategory).mockResolvedValue({ id: 1, name: 'Test' } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    vi.mocked(createCategorySchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'Required' }] } } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('handles CategoryError', async () => {
    const { CategoryError } = await import('@/services/category');
    vi.mocked(createCategorySchema.safeParse).mockReturnValue({ success: true, data: { name: 'Test' } } as any);
    vi.mocked(createCategory).mockRejectedValue(new (CategoryError as any)('Duplicate'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('uses fallback message when issues array is empty', async () => {
    vi.mocked(createCategorySchema.safeParse).mockReturnValue({ success: false, error: { issues: [] } } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Невалідні дані');
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createCategorySchema.safeParse).mockReturnValue({ success: true, data: { name: 'Test' } } as any);
    vi.mocked(createCategory).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
