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
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 1, email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/services/coupon', () => ({
  updateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
}));
vi.mock('@/validators/coupon', () => ({
  updateCouponSchema: { safeParse: vi.fn() },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { PATCH, DELETE } from './route';
import { updateCoupon, deleteCoupon } from '@/services/coupon';
import { updateCouponSchema } from '@/validators/coupon';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('PATCH /api/v1/admin/coupons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates coupon on success', async () => {
    (updateCouponSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { discount: 20 },
    });
    (updateCoupon as any).mockResolvedValue({ id: 1, discount: 20 });

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount: 20 }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeParams('0'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (updateCouponSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { discount: 20 },
    });
    (updateCoupon as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount: 20 }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/coupons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes coupon on success', async () => {
    (deleteCoupon as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('0'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (deleteCoupon as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
