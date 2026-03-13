import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/image', () => ({
  processProductImage: vi.fn(),
  ImageError: class ImageError extends Error { statusCode = 400; },
}));
vi.mock('@/services/cache', () => ({ cacheInvalidate: vi.fn() }));

import { POST } from './route';
import { processProductImage } from '@/services/image';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/products/[id]/images', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when no file provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    vi.mocked(processProductImage).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('uploads image on success', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    vi.mocked(processProductImage).mockResolvedValue({ id: 1, url: '/img.jpg' } as any);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 for non-numeric id', async () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, { params: Promise.resolve({ id: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns ImageError status on ImageError', async () => {
    const { ImageError } = await import('@/services/image');
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    vi.mocked(processProductImage).mockRejectedValue(new (ImageError as any)('too large'));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
