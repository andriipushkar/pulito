import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    banner: { findMany: vi.fn() },
  },
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mocked = vi.mocked(prisma.banner.findMany);
const makeReq = () => new NextRequest('http://localhost/api/v1/banners');

describe('GET /api/v1/banners', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns banners on success', async () => {
    mocked.mockResolvedValue([{ id: 1, title: 'Banner' }] as never);
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
