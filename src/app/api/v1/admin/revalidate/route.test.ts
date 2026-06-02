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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { POST } from './route';
import { revalidatePath } from 'next/cache';

const mockRevalidate = vi.mocked(revalidatePath);

describe('POST /api/v1/admin/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates specific paths', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['/catalog', '/'] }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.revalidated).toContain('path:/catalog');
    expect(json.data.revalidated).toContain('path:/');
    expect(mockRevalidate).toHaveBeenCalledWith('/catalog');
    expect(mockRevalidate).toHaveBeenCalledWith('/');
  });

  it('revalidates by tags', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['products'] }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.revalidated).toContain('tag:products');
  });

  it('revalidates by product type', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'product', slug: 'my-product' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockRevalidate).toHaveBeenCalledWith('/');
    expect(mockRevalidate).toHaveBeenCalledWith('/catalog');
    expect(mockRevalidate).toHaveBeenCalledWith('/product/my-product');
  });

  it('revalidates all pages', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'all' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.revalidated).toContain('all');
    expect(mockRevalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it('revalidates category type', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category' }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.revalidated).toContain('homepage');
    expect(json.data.revalidated).toContain('catalog');
  });

  it('returns 500 on error', async () => {
    mockRevalidate.mockImplementation(() => {
      throw new Error('fail');
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['/'] }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
