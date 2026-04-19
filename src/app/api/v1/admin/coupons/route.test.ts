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
vi.mock('@/services/coupon', () => ({
  getCoupons: vi.fn(),
  createCoupon: vi.fn(),
}));
vi.mock('@/validators/coupon', () => ({
  createCouponSchema: { safeParse: vi.fn() },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, POST } from './route';
import { getCoupons, createCoupon } from '@/services/coupon';
import { createCouponSchema } from '@/validators/coupon';

describe('GET /api/v1/admin/coupons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns coupons on success', async () => {
    (getCoupons as any).mockResolvedValue({ coupons: [{ id: 1 }], total: 1 });

    const req = new NextRequest('http://localhost/api/v1/admin/coupons?page=1&limit=20');
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (getCoupons as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/coupons');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/coupons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates coupon on success', async () => {
    (createCouponSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { code: 'SAVE10' },
    });
    (createCoupon as any).mockResolvedValue({ id: 1, code: 'SAVE10' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE10' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    (createCouponSchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it('returns 409 on duplicate code', async () => {
    (createCouponSchema.safeParse as any).mockReturnValue({ success: true, data: { code: 'DUP' } });
    (createCoupon as any).mockRejectedValue({ code: 'P2002' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DUP' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it('returns 500 on error', async () => {
    (createCouponSchema.safeParse as any).mockReturnValue({ success: true, data: { code: 'X' } });
    (createCoupon as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'X' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
