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

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cookieConsent: { create: vi.fn() },
  },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

const mocked = vi.mocked(prisma.cookieConsent.create);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/cookie-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/cookie-consent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates consent on success', async () => {
    mocked.mockResolvedValue({ id: 1, sessionId: 'abc' } as never);
    const res = await POST(
      makeReq({ sessionId: 'abc', analyticsAccepted: true, marketingAccepted: false }),
    );
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
  });

  it('returns 422 when sessionId missing', async () => {
    const res = await POST(makeReq({ analyticsAccepted: true }));
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({ sessionId: 'abc', analyticsAccepted: true }));
    expect(res.status).toBe(500);
  });
});
