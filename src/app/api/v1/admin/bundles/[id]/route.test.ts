import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bundle: { findUnique: vi.fn() },
  },
}));
vi.mock('@/validators/bundle', () => ({
  updateBundleSchema: { safeParse: vi.fn() },
}));
vi.mock('@/services/bundle', () => ({
  updateBundle: vi.fn(),
  deleteBundle: vi.fn(),
  calculateBundlePrice: vi.fn(),
  BundleError: class BundleError extends Error { statusCode: number; constructor(msg: string, code: number) { super(msg); this.statusCode = code; } },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PATCH, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { updateBundle, deleteBundle, calculateBundlePrice } from '@/services/bundle';
import { updateBundleSchema } from '@/validators/bundle';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/v1/admin/bundles/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns bundle with pricing on success', async () => {
    (prisma.bundle.findUnique as any).mockResolvedValue({ id: 1, name: 'Bundle' });
    (calculateBundlePrice as any).mockResolvedValue({ total: 100, discount: 10 });

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('pricing');
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    (prisma.bundle.findUnique as any).mockResolvedValue(null);

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('999'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.bundle.findUnique as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/bundles/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates bundle on success', async () => {
    (updateBundleSchema.safeParse as any).mockReturnValue({ success: true, data: { name: 'Updated' } });
    (updateBundle as any).mockResolvedValue({ id: 1, name: 'Updated' });

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (updateBundleSchema.safeParse as any).mockReturnValue({ success: true, data: { name: 'X' } });
    (updateBundle as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/bundles/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes bundle on success', async () => {
    (deleteBundle as any).mockResolvedValue(undefined);

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
    (deleteBundle as any).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
