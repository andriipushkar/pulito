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

vi.mock('@/services/loyalty', () => ({
  getTransactionHistory: vi.fn(),
}));

vi.mock('@/validators/loyalty', () => ({
  loyaltyTransactionFilterSchema: { safeParse: vi.fn() },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getTransactionHistory } from '@/services/loyalty';
import { loyaltyTransactionFilterSchema } from '@/validators/loyalty';

const mockGetHistory = getTransactionHistory as ReturnType<typeof vi.fn>;
const mockSafeParse = loyaltyTransactionFilterSchema.safeParse as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/loyalty/transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns transaction history', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { page: 1, limit: 10 } });
    mockGetHistory.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/transactions?page=1&limit=10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 422 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } });
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/transactions');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on server error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { page: 1, limit: 10 } });
    mockGetHistory.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/transactions');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
