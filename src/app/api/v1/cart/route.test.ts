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
    getCartWithPersonalPrices: vi.fn(),
    addToCart: vi.fn(),
    clearCart: vi.fn(),
    mergeCart: vi.fn(),
    CartError,
  };
});

vi.mock('@/validators/order', () => ({
  addToCartSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST, DELETE, PUT } from './route';
import { getCartWithPersonalPrices, addToCart, clearCart, mergeCart } from '@/services/cart';
import { addToCartSchema } from '@/validators/order';

const mockGetCart = getCartWithPersonalPrices as ReturnType<typeof vi.fn>;
const mockAddToCart = addToCart as ReturnType<typeof vi.fn>;
const mockClearCart = clearCart as ReturnType<typeof vi.fn>;
const mockMergeCart = mergeCart as ReturnType<typeof vi.fn>;
const mockSafeParse = addToCartSchema.safeParse as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/cart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cart items', async () => {
    mockGetCart.mockResolvedValue([{ id: 1 }]);
    const req = new NextRequest('http://localhost/api/v1/cart');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([{ id: 1 }]);
  });

  it('returns 500 on error', async () => {
    mockGetCart.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/cart');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/cart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds item to cart', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { productId: 1, quantity: 2 } });
    mockAddToCart.mockResolvedValue({ id: 1 });
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, quantity: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } });
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns CartError status code', async () => {
    const { CartError } = await import('@/services/cart');
    mockSafeParse.mockReturnValue({ success: true, data: { productId: 1, quantity: 1 } });
    mockAddToCart.mockRejectedValue(new CartError('product not found', 404));
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on server error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { productId: 1, quantity: 1 } });
    mockAddToCart.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/cart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears cart', async () => {
    mockClearCart.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/cart', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockClearCart.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/cart', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/cart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges cart items', async () => {
    mockMergeCart.mockResolvedValue([{ id: 1 }]);
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'PUT',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when items is not array', async () => {
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'PUT',
      body: JSON.stringify({ items: 'bad' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockMergeCart.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/cart', {
      method: 'PUT',
      body: JSON.stringify({ items: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
