import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/storage';

const mockFindFirst = prisma.review.findFirst as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.review.update as ReturnType<typeof vi.fn>;
const mockUpload = uploadFile as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('POST /api/v1/reviews/[id]/images', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 if review not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    const formData = new FormData();
    formData.append('image', new File(['data'], 'test.jpg', { type: 'image/jpeg' }));
    const req = new NextRequest('http://localhost/api/v1/reviews/5/images', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when max images reached', async () => {
    mockFindFirst.mockResolvedValue({ id: 5, images: ['a', 'b', 'c', 'd', 'e'] });
    const formData = new FormData();
    formData.append('image', new File(['data'], 'test.jpg', { type: 'image/jpeg' }));
    const req = new NextRequest('http://localhost/api/v1/reviews/5/images', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when no file provided', async () => {
    mockFindFirst.mockResolvedValue({ id: 5, images: [] });
    const formData = new FormData();
    const req = new NextRequest('http://localhost/api/v1/reviews/5/images', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('uploads image on success', async () => {
    mockFindFirst.mockResolvedValue({ id: 5, images: [] });
    mockUpload.mockResolvedValue('https://cdn.example.com/reviews/5/img.jpg');
    mockUpdate.mockResolvedValue({});
    const formData = new FormData();
    formData.append('image', new File(['data'], 'test.jpg', { type: 'image/jpeg' }));
    const req = new NextRequest('http://localhost/api/v1/reviews/5/images', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.totalImages).toBe(1);
  });

  it('returns 500 on error', async () => {
    mockFindFirst.mockRejectedValue(new Error('fail'));
    const formData = new FormData();
    formData.append('image', new File(['data'], 'test.jpg', { type: 'image/jpeg' }));
    const req = new NextRequest('http://localhost/api/v1/reviews/5/images', { method: 'POST', body: formData });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
