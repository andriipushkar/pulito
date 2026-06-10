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

vi.mock('@/services/wishlist', () => {
  class WishlistError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    getUserWishlists: vi.fn(),
    createWishlist: vi.fn(),
    deleteEmptyWishlists: vi.fn(),
    WishlistError,
  };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST, DELETE } from './route';
import { getUserWishlists, createWishlist, deleteEmptyWishlists } from '@/services/wishlist';

const mockGetWishlists = getUserWishlists as ReturnType<typeof vi.fn>;
const mockCreateWishlist = createWishlist as ReturnType<typeof vi.fn>;
const mockDeleteEmpty = deleteEmptyWishlists as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/wishlists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns wishlists', async () => {
    mockGetWishlists.mockResolvedValue([{ id: 1, name: 'Fav' }]);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockGetWishlists.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/wishlists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates wishlist', async () => {
    mockCreateWishlist.mockResolvedValue({ id: 1, name: 'New' });
    const req = new NextRequest('http://localhost/api/v1/me/wishlists', {
      method: 'POST',
      body: JSON.stringify({ name: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 for missing name', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/wishlists', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 422 when name field is missing entirely', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/wishlists', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mockCreateWishlist.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists', {
      method: 'POST',
      body: JSON.stringify({ name: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/me/wishlists', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes empty wishlists', async () => {
    mockDeleteEmpty.mockResolvedValue(2);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockDeleteEmpty.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
