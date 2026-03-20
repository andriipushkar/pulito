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

vi.mock('@/services/subscriber', () => ({
  subscribe: vi.fn(),
  confirmSubscription: vi.fn(),
  unsubscribeByEmail: vi.fn(),
  SubscriberError: class SubscriberError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { POST, GET } from './route';
import { subscribe, confirmSubscription, unsubscribeByEmail } from '@/services/subscriber';

const mockedSubscribe = vi.mocked(subscribe);
const mockedConfirm = vi.mocked(confirmSubscription);
const mockedUnsubscribe = vi.mocked(unsubscribeByEmail);

describe('POST /api/v1/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('subscribes on success', async () => {
    mockedSubscribe.mockResolvedValue({ id: 1 } as never);
    const req = new NextRequest('http://localhost/api/v1/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 422 on invalid email', async () => {
    const req = new NextRequest('http://localhost/api/v1/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 500 on service error', async () => {
    mockedSubscribe.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/v1/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirms subscription with token', async () => {
    mockedConfirm.mockResolvedValue({ confirmed: true } as never);
    const req = new NextRequest('http://localhost/api/v1/subscribe?token=abc123');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('unsubscribes with action=unsubscribe', async () => {
    mockedUnsubscribe.mockResolvedValue({ unsubscribed: true } as never);
    const req = new NextRequest('http://localhost/api/v1/subscribe?token=abc123&action=unsubscribe');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 when token missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/subscribe');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('handles SubscriberError on confirm', async () => {
    const { SubscriberError } = await import('@/services/subscriber');
    mockedConfirm.mockRejectedValue(new SubscriberError('Token expired', 410));
    const req = new NextRequest('http://localhost/api/v1/subscribe?token=expired');
    const res = await GET(req);
    expect(res.status).toBe(410);
  });

  it('returns 500 on generic confirm error', async () => {
    mockedConfirm.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/subscribe?token=abc');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('handles SubscriberError on unsubscribe', async () => {
    const { SubscriberError } = await import('@/services/subscriber');
    mockedUnsubscribe.mockRejectedValue(new SubscriberError('Not found', 404));
    const req = new NextRequest('http://localhost/api/v1/subscribe?token=abc&action=unsubscribe');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/subscribe (SubscriberError)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles SubscriberError on subscribe', async () => {
    const { SubscriberError } = await import('@/services/subscriber');
    mockedSubscribe.mockRejectedValue(new SubscriberError('Already subscribed', 409));
    const req = new NextRequest('http://localhost/api/v1/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
