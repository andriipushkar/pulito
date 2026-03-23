import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/services/recommendation', () => ({
  getPersonalizedRecommendations: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { getPersonalizedRecommendations } from '@/services/recommendation';
import { prisma } from '@/lib/prisma';

const mockGetRecs = getPersonalizedRecommendations as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.product.findMany as ReturnType<typeof vi.fn>;

describe('GET /api/v1/recommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns personalized recommendations for authenticated user', async () => {
    const recs = [{ id: 1, name: 'Soap' }];
    mockGetRecs.mockResolvedValue(recs);
    const req = new NextRequest('http://localhost/api/v1/recommendations?limit=5');
    const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    expect(mockGetRecs).toHaveBeenCalledWith(1, 5);
  });

  it('returns popular products for unauthenticated user', async () => {
    mockFindMany.mockResolvedValue([{ id: 1, name: 'Popular' }]);
    const req = new NextRequest('http://localhost/api/v1/recommendations');
    const noAuthCtx = { user: null };
    const res = await GET(req, noAuthCtx as any);
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockGetRecs.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/recommendations');
    const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
