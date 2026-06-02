import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  checkLoginRateLimit: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  clearLoginAttempts: vi.fn().mockResolvedValue(undefined),
  withRateLimit: () => (h) => h,
  RateLimitError: class RateLimitError extends Error {
    statusCode = 429;
    retryAfter;
    constructor(m, s, r) {
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/services/b2b', () => ({
  resolveBulkOrder: vi.fn(),
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
import { prisma } from '@/lib/prisma';
import { resolveBulkOrder } from '@/services/b2b';

const mockFindUser = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockResolveBulk = resolveBulkOrder as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'wholesaler' } };

function makeReq(body: any) {
  return new NextRequest('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/wholesale/bulk-order', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 on invalid data', async () => {
    const res = await POST(makeReq({ items: [] }), authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 403 for non-wholesaler users', async () => {
    mockFindUser.mockResolvedValue({ role: 'customer', wholesaleGroup: null });
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(403);
  });

  it('resolves bulk order on success', async () => {
    mockFindUser.mockResolvedValue({ role: 'wholesaler', wholesaleGroup: 'A' });
    mockResolveBulk.mockResolvedValue({ items: [{ code: 'P1', price: 100 }], totalAmount: 1000 });
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockFindUser.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({ items: [{ code: 'P1', quantity: 10 }] }), authCtx as any);
    expect(res.status).toBe(500);
  });
});
