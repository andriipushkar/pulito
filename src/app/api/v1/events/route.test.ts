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

vi.mock('@/middleware/auth', () => ({
  withOptionalAuth: (handler: Function) => (req: NextRequest) => handler(req, { user: null }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clientEvent: { create: vi.fn(), createMany: vi.fn() },
  },
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';

const mockCreate = vi.mocked(prisma.clientEvent.create);
const mockCreateMany = vi.mocked(prisma.clientEvent.createMany);

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/v1/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({} as never);
    mockCreateMany.mockResolvedValue({ count: 0 } as never);
  });

  it('records a single page_view event', async () => {
    const res = await POST(makeReq({ eventType: 'page_view', sessionId: 'abc' }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid eventType', async () => {
    const res = await POST(makeReq({ eventType: 'malicious_event' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('records a batch of events', async () => {
    mockCreateMany.mockResolvedValue({ count: 2 } as never);
    const res = await POST(
      makeReq([
        { eventType: 'page_view', sessionId: 's1' },
        { eventType: 'product_view', productId: 5, sessionId: 's1' },
      ]),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.recorded).toBe(2);
  });

  it('rejects oversized batch', async () => {
    const events = Array.from({ length: 51 }, () => ({ eventType: 'page_view' }));
    const res = await POST(makeReq(events));
    expect(res.status).toBe(400);
  });

  it('handles empty batch', async () => {
    const res = await POST(makeReq([]));
    expect(res.status).toBe(200);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('drops invalid events from batch but records valid ones', async () => {
    mockCreateMany.mockResolvedValue({ count: 1 } as never);
    const res = await POST(makeReq([{ eventType: 'page_view' }, { eventType: 'invalid_xyz' }]));
    expect(res.status).toBe(200);
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
  });
});
