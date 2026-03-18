import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: { banner: { update: vi.fn() } },
}));
vi.mock('fs', () => ({ promises: { mkdir: vi.fn(), writeFile: vi.fn() } }));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

// Minimal valid JPEG: starts with FF D8 FF E0 magic bytes
const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe('POST /api/v1/admin/banners/[id]/upload', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uploads image on success', async () => {
    vi.mocked(prisma.banner.update).mockResolvedValue({ id: 1, imageDesktop: '/uploads/banners/test.jpg' } as any);
    const file = new File([jpegBytes], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('image', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.banner.update).mockRejectedValue(new Error('fail'));
    const file = new File([jpegBytes], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('image', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('image', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when no file provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported file type', async () => {
    const file = new File(['test'], 'test.gif', { type: 'image/gif' });
    const formData = new FormData();
    formData.append('image', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('handles file without extension', async () => {
    vi.mocked(prisma.banner.update).mockResolvedValue({ id: 1 } as any);
    const file = new File([jpegBytes], 'image', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('image', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for file too large', async () => {
    const largeContent = new Uint8Array(6 * 1024 * 1024);
    const file = new File([largeContent], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('image', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
