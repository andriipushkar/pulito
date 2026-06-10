import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  checkLoginRateLimit: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  clearLoginAttempts: vi.fn().mockResolvedValue(undefined),
  withRateLimit: () => (h: unknown) => h,
  RateLimitError: class RateLimitError extends Error {
    statusCode = 429;
    retryAfter;
    constructor(m: string, s?: number, r?: number) {
      super(m);
      this.statusCode = s || 429;
      this.retryAfter = r;
    }
  },
  RATE_LIMITS: new Proxy(
    {},
    { get: () => ({ limit: 100, windowSeconds: 60, prefix: 'test', max: 1e9, windowSec: 60 }) },
  ),
}));
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
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
      handler,
}));

vi.mock('@/services/coupon', () => {
  class CouponError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    validateCoupon: vi.fn(),
    calculateDiscount: vi.fn(),
    CouponError,
  };
});

vi.mock('@/validators/coupon', () => ({
  applyCouponSchema: { safeParse: vi.fn() },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) =>
      NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { validateCoupon, calculateDiscount, CouponError } from '@/services/coupon';
import { applyCouponSchema } from '@/validators/coupon';

const mockValidate = validateCoupon as ReturnType<typeof vi.fn>;
const mockCalcDiscount = calculateDiscount as ReturnType<typeof vi.fn>;
const mockSafeParse = applyCouponSchema.safeParse as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('POST /api/v1/coupons/validate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns discount on valid coupon', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { code: 'SAVE10' } });
    mockValidate.mockResolvedValue({
      id: 1,
      code: 'SAVE10',
      type: 'percentage',
      description: '10% off',
    });
    mockCalcDiscount.mockReturnValue(50);
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE10', orderAmount: 500 }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.discount).toBe(50);
  });

  it('returns CouponError status', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { code: 'EXPIRED' } });
    mockValidate.mockRejectedValue(new CouponError('Coupon expired', 400));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'EXPIRED', orderAmount: 500 }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { code: 'SAVE10' } });
    mockValidate.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE10', orderAmount: 500 }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
