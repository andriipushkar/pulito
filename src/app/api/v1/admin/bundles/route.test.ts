import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
    bundle: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock('@/validators/bundle', () => ({
  createBundleSchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/bundle', () => ({
  createBundle: vi.fn(),
  BundleError: class BundleError extends Error {
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
  paginatedResponse: (data: any, total: number, page: number, limit: number) =>
    Response.json({ data, total, page, limit }),
  parseSearchParams: (params: URLSearchParams) => ({
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 20,
    search: params.get('search') || '',
  }),
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';
import { createBundle } from '@/services/bundle';
import { createBundleSchema } from '@/validators/bundle';

describe('GET /api/v1/admin/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated bundles on success', async () => {
    (prisma.bundle.findMany as any).mockResolvedValue([{ id: 1, name: 'Bundle' }]);
    (prisma.bundle.count as any).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/v1/admin/bundles');
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (prisma.bundle.findMany as any).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/v1/admin/bundles');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates bundle on success', async () => {
    (createBundleSchema.safeParse as any).mockReturnValue({ success: true, data: { name: 'New' } });
    (createBundle as any).mockResolvedValue({ id: 1, name: 'New' });

    const req = new NextRequest('http://localhost/api/v1/admin/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    const res = await POST(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    (createBundleSchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    });

    const req = new NextRequest('http://localhost/api/v1/admin/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    (createBundleSchema.safeParse as any).mockReturnValue({ success: true, data: { name: 'X' } });
    (createBundle as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await POST(req, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
