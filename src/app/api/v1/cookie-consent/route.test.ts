import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    const res = await POST(makeReq({ sessionId: 'abc', analyticsAccepted: true, marketingAccepted: false }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
  });

  it('returns 400 when sessionId missing', async () => {
    const res = await POST(makeReq({ analyticsAccepted: true }));
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const res = await POST(makeReq({ sessionId: 'abc', analyticsAccepted: true }));
    expect(res.status).toBe(500);
  });
});
