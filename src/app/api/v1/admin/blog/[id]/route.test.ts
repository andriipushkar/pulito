import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    blogPost: { findUnique: vi.fn() },
  },
}));
vi.mock('@/validators/blog', () => ({
  updateBlogPostSchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/blog', () => ({
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  BlogError: class BlogError extends Error { statusCode: number; constructor(msg: string, code: number) { super(msg); this.statusCode = code; } },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PATCH, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { updatePost, deletePost } from '@/services/blog';
import { updateBlogPostSchema } from '@/validators/blog';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/v1/admin/blog/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns post on success', async () => {
    (prisma.blogPost.findUnique as any).mockResolvedValue({ id: 1, title: 'Post' });

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    (prisma.blogPost.findUnique as any).mockResolvedValue(null);

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('999'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.blogPost.findUnique as any).mockRejectedValue(new Error('DB error'));

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/blog/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates post on success', async () => {
    (updateBlogPostSchema.safeParse as any).mockReturnValue({ success: true, data: { title: 'Updated' } });
    (updatePost as any).mockResolvedValue({ id: 1, title: 'Updated' });

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    const res = await PATCH(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (updateBlogPostSchema.safeParse as any).mockReturnValue({ success: true, data: { title: 'Updated' } });
    (updatePost as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/blog/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes post on success', async () => {
    (deletePost as any).mockResolvedValue(undefined);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (deletePost as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
