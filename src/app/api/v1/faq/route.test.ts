import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/faq', () => ({
  getPublishedFaq: vi.fn(),
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));

import { NextRequest } from 'next/server';
import { GET } from './route';
import { getPublishedFaq } from '@/services/faq';

const mocked = vi.mocked(getPublishedFaq);
const makeReq = () => new NextRequest('http://localhost/api/v1/faq');

describe('GET /api/v1/faq', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns FAQ on success', async () => {
    mocked.mockResolvedValue([{ id: 1, question: 'Q?' }] as never);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
