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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    loyaltyChallenge: { findMany: vi.fn() },
    loyaltyChallengeProgress: { findMany: vi.fn() },
  },
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

import { GET } from './route';
import { prisma } from '@/lib/prisma';

const mockFindChallenges = prisma.loyaltyChallenge.findMany as ReturnType<typeof vi.fn>;
const mockFindProgress = prisma.loyaltyChallengeProgress.findMany as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/loyalty/challenges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns challenges with progress', async () => {
    mockFindChallenges.mockResolvedValue([
      {
        id: 1,
        name: 'Buy 5',
        description: 'Buy 5 products',
        type: 'purchase_count',
        target: 5,
        reward: 100,
        endDate: null,
        createdAt: new Date(),
      },
    ]);
    mockFindProgress.mockResolvedValue([
      { challengeId: 1, currentValue: 3, completedAt: null, rewardedAt: null },
    ]);

    const req = new NextRequest('http://localhost/api/v1/me/loyalty/challenges');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].currentValue).toBe(3);
    expect(json.data[0].isCompleted).toBe(false);
  });

  it('returns empty when no challenges', async () => {
    mockFindChallenges.mockResolvedValue([]);
    mockFindProgress.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/v1/me/loyalty/challenges');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it('returns 500 on error', async () => {
    mockFindChallenges.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/loyalty/challenges');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
