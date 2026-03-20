import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 }),
  RATE_LIMITS: { sensitive: { prefix: 'rl:sens:', max: 3, windowSec: 900 } },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/feedback', () => ({
  createFeedback: vi.fn(),
}));

vi.mock('@/services/telegram', () => ({
  notifyManagerFeedback: vi.fn(),
}));

import { POST } from './route';
import { createFeedback } from '@/services/feedback';

const mocked = vi.mocked(createFeedback);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/callback-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/callback-request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates callback request on success', async () => {
    mocked.mockResolvedValue({ id: 1 } as never);
    const res = await POST(makeReq({ name: 'Test User', phone: '+380123456789' }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
  });

  it('returns 422 on validation error', async () => {
    const res = await POST(makeReq({ name: 'T', phone: '123' }));
    expect(res.status).toBe(422);
  });

  it('returns 500 on service error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({ name: 'Test User', phone: '+380123456789' }));
    expect(res.status).toBe(500);
  });
});
