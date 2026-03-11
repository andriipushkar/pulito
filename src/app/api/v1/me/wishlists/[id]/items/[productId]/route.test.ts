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
    isProductInWishlist: vi.fn(),
    addItemToWishlist: vi.fn(),
    removeItemFromWishlist: vi.fn(),
    WishlistError,
  };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST, DELETE } from './route';
import { resolveWishlistId, isProductInWishlist, addItemToWishlist, removeItemFromWishlist } from '@/services/wishlist';

const mockResolve = resolveWishlistId as ReturnType<typeof vi.fn>;
const mockIsInWishlist = isProductInWishlist as ReturnType<typeof vi.fn>;
const mockAddItem = addItemToWishlist as ReturnType<typeof vi.fn>;
const mockRemoveItem = removeItemFromWishlist as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5', productId: '10' }) };

describe('GET /api/v1/me/wishlists/[id]/items/[productId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks if product is in wishlist', async () => {
    mockResolve.mockResolvedValue(5);
    mockIsInWishlist.mockResolvedValue(true);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.wishlisted).toBe(true);
  });

  it('returns 400 for invalid productId', async () => {
    mockResolve.mockResolvedValue(5);
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5', productId: 'abc' }) };
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/abc');
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockRejectedValue(new WishlistError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/me/wishlists/[id]/items/[productId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds product to wishlist', async () => {
    mockResolve.mockResolvedValue(5);
    mockAddItem.mockResolvedValue({ id: 1 });
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockResolvedValue(5);
    mockAddItem.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for invalid productId', async () => {
    mockResolve.mockResolvedValue(5);
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5', productId: 'abc' }) };
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/abc', { method: 'POST' });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockResolvedValue(5);
    mockAddItem.mockRejectedValue(new WishlistError('duplicate', 409));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10', { method: 'POST' });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/v1/me/wishlists/[id]/items/[productId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes product from wishlist', async () => {
    mockResolve.mockResolvedValue(5);
    mockRemoveItem.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockResolvedValue(5);
    mockRemoveItem.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for invalid productId', async () => {
    mockResolve.mockResolvedValue(5);
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5', productId: 'abc' }) };
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/abc', { method: 'DELETE' });
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockRejectedValue(new WishlistError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5/items/10', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});
