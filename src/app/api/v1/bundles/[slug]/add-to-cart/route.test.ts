import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: (..._roles: string[]) => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    bundle: { findUnique: vi.fn() },
  },
}));

vi.mock('@/services/bundle', () => {
  class BundleError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    addBundleToCart: vi.fn(),
    BundleError,
  };
});

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { addBundleToCart, BundleError } from '@/services/bundle';

const mockFindBundle = prisma.bundle.findUnique as ReturnType<typeof vi.fn>;
const mockAddToCart = addBundleToCart as ReturnType<typeof vi.fn>;

const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ slug: 'bundle-1' }) };

describe('POST /api/v1/bundles/[slug]/add-to-cart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 if bundle not found', async () => {
    mockFindBundle.mockResolvedValue(null);
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('adds bundle to cart on success', async () => {
    mockFindBundle.mockResolvedValue({ id: 1 });
    mockAddToCart.mockResolvedValue([{ productId: 1, quantity: 1 }]);
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns BundleError status', async () => {
    mockFindBundle.mockResolvedValue({ id: 1 });
    mockAddToCart.mockRejectedValue(new BundleError('Out of stock', 400));
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockFindBundle.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
