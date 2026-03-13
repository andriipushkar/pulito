import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withOptionalAuth: (handler: Function) => (...args: unknown[]) => handler(...args),
  withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args),
}));

vi.mock('@/services/push', () => ({
  subscribePush: vi.fn(),
  getVapidPublicKey: vi.fn(),
}));

import { POST, GET } from './route';
import { subscribePush, getVapidPublicKey } from '@/services/push';

const mockedSubscribe = vi.mocked(subscribePush);
const mockedVapid = vi.mocked(getVapidPublicKey);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/push/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('subscribes on success', async () => {
    mockedSubscribe.mockResolvedValue(undefined as never);
    const req = makeReq({ endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.subscribed).toBe(true);
  });

  it('returns 400 on missing keys', async () => {
    const req = makeReq({ endpoint: 'https://push.example.com' });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockedSubscribe.mockRejectedValue(new Error('fail'));
    const req = makeReq({ endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } });
    const res = await POST(req, { user: { id: 1 }, params: Promise.resolve({}) } as any);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/v1/push/subscribe (VAPID key)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns public key', async () => {
    mockedVapid.mockReturnValue('vapid-key');
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.publicKey).toBe('vapid-key');
  });

  it('returns 503 when VAPID not configured', async () => {
    mockedVapid.mockReturnValue(null as never);
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
