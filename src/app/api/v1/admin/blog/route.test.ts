import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    blogPost: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock('@/validators/blog', () => ({
  createBlogPostSchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/blog', () => ({
  createPost: vi.fn(),
  BlogError: class BlogError extends Error { statusCode: number; constructor(msg: string, code: number) { super(msg); this.statusCode = code; } },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  paginatedResponse: (data: any, total: number, page: number, limit: number) => Response.json({ data, total, page, limit }),
  parseSearchParams: (params: URLSearchParams) => ({
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 20,
    search: params.get('search') || '',
  }),
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';
import { createPost } from '@/services/blog';
import { createBlogPostSchema } from '@/validators/blog';

describe('GET /api/v1/admin/blog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated posts on success', async () => {
    (prisma.blogPost.findMany as any).mockResolvedValue([{ id: 1, title: 'Test' }]);
    (prisma.blogPost.count as any).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/v1/admin/blog?page=1&limit=20');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    (prisma.blogPost.findMany as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/v1/admin/blog');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/blog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a post on success', async () => {
    (createBlogPostSchema.safeParse as any).mockReturnValue({ success: true, data: { title: 'New Post' } });
    (createPost as any).mockResolvedValue({ id: 1, title: 'New Post' });

    const req = new NextRequest('http://localhost/api/v1/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Post' }),
    });
    const res = await POST(req, { user: { id: 1 } });

    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    (createBlogPostSchema.safeParse as any).mockReturnValue({ success: false, error: { issues: [{ message: 'Invalid' }] } });

    const req = new NextRequest('http://localhost/api/v1/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { user: { id: 1 } });

    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    (createBlogPostSchema.safeParse as any).mockReturnValue({ success: true, data: { title: 'New' } });
    (createPost as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New' }),
    });
    const res = await POST(req, { user: { id: 1 } });

    expect(res.status).toBe(500);
  });
});
