import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/image', () => ({
  deleteProductImage: vi.fn(),
  ImageError: class ImageError extends Error { statusCode = 400; },
}));
vi.mock('@/services/cache', () => ({ cacheInvalidate: vi.fn() }));

import { DELETE } from './route';
import { deleteProductImage } from '@/services/image';

const mockCtx = { params: Promise.resolve({ imageId: '1' }) };

describe('DELETE /api/v1/admin/products/[id]/images/[imageId]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes image on success', async () => {
    vi.mocked(deleteProductImage).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deleteProductImage).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric imageId', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ imageId: 'abc' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns ImageError status on ImageError', async () => {
    const { ImageError } = await import('@/services/image');
    vi.mocked(deleteProductImage).mockRejectedValue(new (ImageError as any)('not found'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
