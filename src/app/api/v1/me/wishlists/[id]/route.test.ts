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
    getWishlistById: vi.fn(),
    updateWishlist: vi.fn(),
    deleteWishlist: vi.fn(),
    WishlistError,
  };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, PUT, DELETE } from './route';
import { resolveWishlistId, getWishlistById, updateWishlist, deleteWishlist } from '@/services/wishlist';

const mockResolve = resolveWishlistId as ReturnType<typeof vi.fn>;
const mockGetById = getWishlistById as ReturnType<typeof vi.fn>;
const mockUpdate = updateWishlist as ReturnType<typeof vi.fn>;
const mockDelete = deleteWishlist as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('GET /api/v1/me/wishlists/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns wishlist by id', async () => {
    mockResolve.mockResolvedValue(5);
    mockGetById.mockResolvedValue({ id: 5, name: 'Fav' });
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockRejectedValue(new WishlistError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/me/wishlists/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates wishlist name', async () => {
    mockResolve.mockResolvedValue(5);
    mockUpdate.mockResolvedValue({ id: 5, name: 'Updated' });
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 422 for missing name', async () => {
    mockResolve.mockResolvedValue(5);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockResolvedValue(5);
    mockUpdate.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockRejectedValue(new WishlistError('forbidden', 403));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/me/wishlists/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes wishlist', async () => {
    mockResolve.mockResolvedValue(5);
    mockDelete.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockResolve.mockResolvedValue(5);
    mockDelete.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns WishlistError status on WishlistError', async () => {
    const { WishlistError } = await import('@/services/wishlist');
    mockResolve.mockRejectedValue(new WishlistError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/me/wishlists/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});
