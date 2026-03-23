import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/subscription', () => {
  class SubscriptionError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    createSubscription: vi.fn(),
    getUserSubscriptions: vi.fn(),
    SubscriptionError,
  };
});

vi.mock('@/validators/subscription', () => ({
  createSubscriptionSchema: { safeParse: vi.fn() },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET, POST } from './route';
import { createSubscription, getUserSubscriptions, SubscriptionError } from '@/services/subscription';
import { createSubscriptionSchema } from '@/validators/subscription';

const mockGetSubs = getUserSubscriptions as ReturnType<typeof vi.fn>;
const mockCreateSub = createSubscription as ReturnType<typeof vi.fn>;
const mockSafeParse = createSubscriptionSchema.safeParse as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/subscriptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns subscriptions', async () => {
    mockGetSubs.mockResolvedValue([{ id: 1, productId: 1 }]);
    const req = new NextRequest('http://localhost/api/v1/me/subscriptions');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockGetSubs.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/subscriptions');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/subscriptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 422 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'invalid' }] } });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('creates subscription on success', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { productId: 1, intervalDays: 30 } });
    mockCreateSub.mockResolvedValue({ id: 1, productId: 1 });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1, intervalDays: 30 }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns SubscriptionError status', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { productId: 1 } });
    mockCreateSub.mockRejectedValue(new SubscriptionError('Already exists', 409));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1 }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(409);
  });

  it('returns 500 on unexpected error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { productId: 1 } });
    mockCreateSub.mockRejectedValue(new Error('db fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1 }),
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
