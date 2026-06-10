import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  checkLoginRateLimit: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  clearLoginAttempts: vi.fn().mockResolvedValue(undefined),
  withRateLimit: () => (h: unknown) => h,
  RateLimitError: class RateLimitError extends Error {
    statusCode = 429;
    retryAfter;
    constructor(m: string, s?: number, r?: number) {
      super(m);
      this.statusCode = s || 429;
      this.retryAfter = r;
    }
  },
  RATE_LIMITS: new Proxy(
    {},
    { get: () => ({ limit: 100, windowSeconds: 60, prefix: 'test', max: 1e9, windowSec: 60 }) },
  ),
}));
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
      handler,
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
    getSubscriptionById: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    pauseSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
    SubscriptionError,
  };
});

vi.mock('@/validators/subscription', () => ({
  updateSubscriptionSchema: { safeParse: vi.fn() },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) =>
      NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) =>
      NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET, PATCH, DELETE } from './route';
import {
  getSubscriptionById,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  SubscriptionError,
} from '@/services/subscription';
import { updateSubscriptionSchema } from '@/validators/subscription';

const mockGetById = getSubscriptionById as ReturnType<typeof vi.fn>;
const mockUpdate = updateSubscription as ReturnType<typeof vi.fn>;
const mockCancel = cancelSubscription as ReturnType<typeof vi.fn>;
const mockPause = pauseSubscription as ReturnType<typeof vi.fn>;
const mockResume = resumeSubscription as ReturnType<typeof vi.fn>;
const mockSafeParse = updateSubscriptionSchema.safeParse as ReturnType<typeof vi.fn>;

const authCtx = {
  user: { id: 1, email: 'test@test.com', role: 'admin' },
  params: Promise.resolve({ id: '5' }),
};
const invalidCtx = {
  user: { id: 1, email: 'test@test.com', role: 'admin' },
  params: Promise.resolve({ id: 'abc' }),
};

describe('GET /api/v1/me/subscriptions/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost');
    const res = await GET(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns subscription on success', async () => {
    mockGetById.mockResolvedValue({ id: 5, productId: 1 });
    const req = new NextRequest('http://localhost');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns SubscriptionError status', async () => {
    mockGetById.mockRejectedValue(new SubscriptionError('Not found', 404));
    const req = new NextRequest('http://localhost');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetById.mockRejectedValue(new Error('db fail'));
    const req = new NextRequest('http://localhost');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/me/subscriptions/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 422 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'invalid' }] } });
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('pauses subscription when status is paused', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { status: 'paused' } });
    mockPause.mockResolvedValue({ id: 5, status: 'paused' });
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    });
    const res = await PATCH(req, authCtx as any);
    expect(res.status).toBe(200);
    expect(mockPause).toHaveBeenCalledWith(5, 1);
  });

  it('resumes subscription when status is active', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { status: 'active' } });
    mockResume.mockResolvedValue({ id: 5, status: 'active' });
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    const res = await PATCH(req, authCtx as any);
    expect(res.status).toBe(200);
    expect(mockResume).toHaveBeenCalledWith(5, 1);
  });

  it('updates subscription for other changes', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { intervalDays: 14 } });
    mockUpdate.mockResolvedValue({ id: 5, intervalDays: 14 });
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalDays: 14 }),
    });
    const res = await PATCH(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { intervalDays: 14 } });
    mockUpdate.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalDays: 14 }),
    });
    const res = await PATCH(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/me/subscriptions/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, invalidCtx as any);
    expect(res.status).toBe(400);
  });

  it('cancels subscription on success', async () => {
    mockCancel.mockResolvedValue({ id: 5, status: 'cancelled' });
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns SubscriptionError status', async () => {
    mockCancel.mockRejectedValue(new SubscriptionError('Already cancelled', 400));
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockCancel.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
