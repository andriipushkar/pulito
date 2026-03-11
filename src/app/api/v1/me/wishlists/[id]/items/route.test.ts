import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    resolveWishlistId: vi.fn(),
    addItemToWishlist: vi.fn(),
    WishlistError,
  };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { resolveWishlistId, addItemToWishlist } from '@/services/wishlist';

const mockResolve = resolveWishlistId as ReturnType<typeof vi.fn>;
const mockAddItem = addItemToWishlist as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('POST /api/v1/me/wishlists/[id]/items', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds item to wishlist', async () => {
    mockResolve.mockResolvedValue(5);
    mockAddItem.mockResolvedValue({ id: 1, productId: 10 });
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 10 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 for invalid productId', async () => {
    mockResolve.mockResolvedValue(5);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items', {
      method: 'POST',
      body: JSON.stringify({ productId: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockResolvedValue(5);
    mockAddItem.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 10 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockResolvedValue(5);
    mockAddItem.mockRejectedValue(new WishlistError('duplicate', 409));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items', {
      method: 'POST',
      body: JSON.stringify({ productId: 10 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(409);
  });
});
