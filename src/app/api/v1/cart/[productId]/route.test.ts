import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/cart', () => {
  class CartError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    updateCartItem: vi.fn(),
    removeFromCart: vi.fn(),
    CartError,
  };
});

vi.mock('@/validators/order', () => ({
  updateCartItemSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { PUT, DELETE } from './route';
import { updateCartItem, removeFromCart } from '@/services/cart';
import { updateCartItemSchema } from '@/validators/order';

const mockUpdateCartItem = updateCartItem as ReturnType<typeof vi.fn>;
const mockRemoveFromCart = removeFromCart as ReturnType<typeof vi.fn>;
const mockSafeParse = updateCartItemSchema.safeParse as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ productId: '5' }) };

describe('PUT /api/v1/cart/[productId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates cart item quantity', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { quantity: 3 } });
    mockUpdateCartItem.mockResolvedValue({ id: 1, quantity: 3 });
    const req = new NextRequest('http://localhost/api/v1/cart/5', {
      method: 'PUT',
      body: JSON.stringify({ quantity: 3 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid productId', async () => {
    const req = new NextRequest('http://localhost/api/v1/cart/abc', {
      method: 'PUT',
      body: JSON.stringify({ quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ productId: 'abc' }) };
    const res = await PUT(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad qty' }] } });
    const req = new NextRequest('http://localhost/api/v1/cart/5', {
      method: 'PUT',
      body: JSON.stringify({ quantity: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns CartError status code on PUT', async () => {
    const { CartError } = await import('@/services/cart');
    mockSafeParse.mockReturnValue({ success: true, data: { quantity: 1 } });
    mockUpdateCartItem.mockRejectedValue(new CartError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/cart/5', {
      method: 'PUT',
      body: JSON.stringify({ quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on server error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { quantity: 1 } });
    mockUpdateCartItem.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/cart/5', {
      method: 'PUT',
      body: JSON.stringify({ quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/cart/[productId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes item from cart', async () => {
    mockRemoveFromCart.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/cart/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid productId', async () => {
    const req = new NextRequest('http://localhost/api/v1/cart/abc', { method: 'DELETE' });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ productId: 'abc' }) };
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns CartError status code on DELETE', async () => {
    const { CartError } = await import('@/services/cart');
    mockRemoveFromCart.mockRejectedValue(new CartError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/cart/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on server error', async () => {
    mockRemoveFromCart.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/cart/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
