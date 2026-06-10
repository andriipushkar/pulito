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

vi.mock('@/services/static-page', () => ({
  getPageBySlug: vi.fn(),
}));

import { GET } from './route';
import { getPageBySlug } from '@/services/static-page';

const mocked = vi.mocked(getPageBySlug);

describe('GET /api/v1/pages/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns page on success', async () => {
    mocked.mockResolvedValue({ id: 1, title: 'About' } as never);
    const req = new NextRequest('http://localhost/api/v1/pages/about');
    const res = await GET(req, { params: Promise.resolve({ slug: 'about' }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 404 when not found', async () => {
    mocked.mockResolvedValue(null as never);
    const req = new NextRequest('http://localhost/api/v1/pages/missing');
    const res = await GET(req, { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/pages/err');
    const res = await GET(req, { params: Promise.resolve({ slug: 'err' }) });
    expect(res.status).toBe(500);
  });
});
