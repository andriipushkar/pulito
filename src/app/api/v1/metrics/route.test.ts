import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/performance', () => ({
  recordMetric: vi.fn(),
}));

import { POST } from './route';
import { recordMetric } from '@/services/performance';

const mocked = vi.mocked(recordMetric);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records metric and returns 204', async () => {
    mocked.mockResolvedValue(undefined as never);
    const res = await POST(makeReq({ route: '/', metric: 'LCP', value: 100 }));
    expect(res.status).toBe(204);
  });

  it('returns 400 on missing fields', async () => {
    const res = await POST(makeReq({ route: '/' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid metric name', async () => {
    const res = await POST(makeReq({ route: '/', metric: 'INVALID', value: 100 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on parse error', async () => {
    const req = new NextRequest('http://localhost/api/v1/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
