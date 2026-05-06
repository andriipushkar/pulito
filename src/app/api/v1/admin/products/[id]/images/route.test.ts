import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args),
}));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
  },
}));
vi.mock('@/services/image', () => ({
  processProductImage: vi.fn(),
  ImageError: class ImageError extends Error {
    statusCode = 400;
  },
}));
vi.mock('@/services/cache', () => ({ cacheInvalidate: vi.fn() }));

import { POST } from './route';
import { processProductImage } from '@/services/image';

const mockCtx = { params: Promise.resolve({ id: '1' }) };

describe('POST /api/v1/admin/products/[id]/images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no file provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when all files fail processing', async () => {
    // Per-file errors are now isolated — when every file fails, the route
    // returns 400 with a `{ ok: [], failed: [...] }` payload instead of 500.
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    vi.mocked(processProductImage).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
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

  it('processes multiple files, isolates per-file failures', async () => {
    const f1 = new File(['ok'], 'good.jpg', { type: 'image/jpeg' });
    const f2 = new File(['bad'], 'bad.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', f1);
    formData.append('images', f2);
    vi.mocked(processProductImage)
      .mockResolvedValueOnce({ id: 1 } as any)
      .mockRejectedValueOnce(new Error('boom'));
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.ok).toHaveLength(1);
    expect(body.data.failed).toHaveLength(1);
    expect(body.data.failed[0].filename).toBe('bad.jpg');
  });

  it('passes removeBg flag when provided', async () => {
    const file = new File(['ok'], 'a.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('images', file);
    formData.append('removeBg', 'true');
    vi.mocked(processProductImage).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    await POST(req as any, mockCtx as any);
    expect(processProductImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      'a.jpg',
      1,
      false,
      { removeBg: true },
    );
  });
});
