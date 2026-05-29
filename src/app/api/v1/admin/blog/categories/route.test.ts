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
vi.mock('@/middleware/auth', () => {
  const withUser = (_req: unknown, ctx?: Record<string, unknown>) => ({
    user: { id: 1, email: 'admin@test.com', role: 'admin' },
    ...(ctx || {}),
  });
  const roleWrap =
    (..._roles: unknown[]) =>
    (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, withUser(req, ctx));
  const authWrap = (handler: Function) => (req: unknown, ctx?: Record<string, unknown>) =>
    handler(req, withUser(req, ctx));
  return {
    withRole: roleWrap,
    withRole2fa: roleWrap,
    withAuth: authWrap,
    withOptionalAuth: authWrap,
  };
});
vi.mock('@/validators/blog', () => ({
  createBlogCategorySchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/blog', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
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

import { GET, POST } from './route';
import { getCategories, createCategory } from '@/services/blog';
import { createBlogCategorySchema } from '@/validators/blog';

describe('GET /api/v1/admin/blog/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns categories on success', async () => {
    (getCategories as any).mockResolvedValue([{ id: 1, name: 'Tech' }]);

    const res = await (GET as any)();

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (getCategories as any).mockRejectedValue(new Error('fail'));

    const res = await (GET as any)();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/blog/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates category on success', async () => {
    (createBlogCategorySchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'New Cat' },
    });
    (createCategory as any).mockResolvedValue({ id: 1, name: 'New Cat' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Cat' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    (createBlogCategorySchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    (createBlogCategorySchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'Cat' },
    });
    (createCategory as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cat' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
