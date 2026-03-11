import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/push', () => ({
  unsubscribePush: vi.fn(),
}));

import { POST } from './route';
import { unsubscribePush } from '@/services/push';

const mocked = vi.mocked(unsubscribePush);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/push/unsubscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unsubscribes on success', async () => {
    mocked.mockResolvedValue(undefined as never);
    const req = makeReq({ endpoint: 'https://push.example.com' });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.unsubscribed).toBe(true);
  });

  it('returns 400 when endpoint missing', async () => {
    const req = makeReq({});
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = makeReq({ endpoint: 'https://push.example.com' });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) });
    expect(res.status).toBe(500);
  });
});
