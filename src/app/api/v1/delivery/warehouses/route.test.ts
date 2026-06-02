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

vi.mock('@/services/nova-poshta', () => {
  class NovaPoshtaError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { getWarehouses: vi.fn(), NovaPoshtaError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getWarehouses } from '@/services/nova-poshta';

const mockGetWarehouses = getWarehouses as ReturnType<typeof vi.fn>;

describe('GET /api/v1/delivery/warehouses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns warehouses for valid cityRef', async () => {
    mockGetWarehouses.mockResolvedValue([{ id: 1, name: 'Warehouse 1' }]);
    const req = new NextRequest('http://localhost/api/v1/delivery/warehouses?cityRef=abc');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing cityRef', async () => {
    const req = new NextRequest('http://localhost/api/v1/delivery/warehouses');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('passes search query param', async () => {
    mockGetWarehouses.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/v1/delivery/warehouses?cityRef=abc&q=main');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetWarehouses).toHaveBeenCalledWith('abc', 'main');
  });

  it('returns NovaPoshtaError status code', async () => {
    const { NovaPoshtaError } = await import('@/services/nova-poshta');
    mockGetWarehouses.mockRejectedValue(new NovaPoshtaError('API error', 503));
    const req = new NextRequest('http://localhost/api/v1/delivery/warehouses?cityRef=abc');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('returns 500 on error', async () => {
    mockGetWarehouses.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/delivery/warehouses?cityRef=abc');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
