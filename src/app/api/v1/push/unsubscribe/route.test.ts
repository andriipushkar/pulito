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
  withAuth:
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args),
  withOptionalAuth:
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args),
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args),
}));

vi.mock('@/services/push', () => ({
  unsubscribePush: vi.fn(),
}));

import { POST } from './route';
import { unsubscribePush } from '@/services/push';

const mocked = vi.mocked(unsubscribePush);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/push/unsubscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unsubscribes on success', async () => {
    mocked.mockResolvedValue(undefined as never);
    const req = makeReq({ endpoint: 'https://push.example.com' });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.unsubscribed).toBe(true);
  });

  it('returns 422 when endpoint missing', async () => {
    const req = makeReq({});
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = makeReq({ endpoint: 'https://push.example.com' });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(500);
  });
});
