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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    product: { updateMany: vi.fn() },
  },
}));
vi.mock('@/services/cache', () => ({
  cacheInvalidate: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/v1/admin/categories/[id]/merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges categories on success', async () => {
    (prisma.category.findUnique as any)
      .mockResolvedValueOnce({ id: 1, name: 'Source', _count: { products: 5 } })
      .mockResolvedValueOnce({ id: 2, name: 'Target' });
    (prisma.product.updateMany as any).mockResolvedValue({ count: 5 });
    (prisma.category.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.category.update as any).mockResolvedValue({});
    (prisma.category.delete as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCategoryId: 2 }),
    });
    const res = await POST(req, makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.merged).toBe(true);
    expect(data.movedProducts).toBe(5);
  });

  it('returns 400 for invalid source ID', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCategoryId: 2 }),
    });
    const res = await POST(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 400 when merging category with itself', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCategoryId: 1 }),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(400);
  });

  it('returns 400 when targetCategoryId is missing', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when source not found', async () => {
    (prisma.category.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 2, name: 'Target' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCategoryId: 2 }),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.category.findUnique as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCategoryId: 2 }),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
