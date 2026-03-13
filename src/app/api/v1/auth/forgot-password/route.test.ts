import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/verification', () => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 }),
  RATE_LIMITS: { sensitive: { prefix: 'rl:sens:', max: 3, windowSec: 900 } },
  RateLimitError: class RateLimitError extends Error {
    statusCode: number;
    retryAfter?: number;
    constructor(message: string, statusCode = 429, retryAfter?: number) {
      super(message);
      this.statusCode = statusCode;
      this.retryAfter = retryAfter;
    }
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { requestPasswordReset } from '@/services/verification';

const mockRequestPasswordReset = requestPasswordReset as ReturnType<typeof vi.fn>;

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns success for valid email', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('user@example.com');
  });

  it('returns 422 for invalid email', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(422);
  });

  it('returns 500 on server error', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('fail'));
    const res = await POST(makeRequest({ email: 'user@example.com' }));
    expect(res.status).toBe(500);
  });
});
