import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
      handler,
}));
vi.mock('@/validators/blog', () => ({
  updateBlogCategorySchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/blog', () => ({
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  BlogError: class BlogError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { PATCH, DELETE } from './route';
import { updateCategory, deleteCategory } from '@/services/blog';
import { updateBlogCategorySchema } from '@/validators/blog';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PATCH /api/v1/admin/blog/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates category on success', async () => {
    (updateBlogCategorySchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'Updated' },
    });
    (updateCategory as any).mockResolvedValue({ id: 1, name: 'Updated' });

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (updateBlogCategorySchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'X' },
    });
    (updateCategory as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/blog/categories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes category on success', async () => {
    (deleteCategory as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (deleteCategory as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
