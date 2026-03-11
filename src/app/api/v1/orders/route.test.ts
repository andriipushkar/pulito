import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/order', () => {
  class OrderError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    createOrder: vi.fn(),
    getUserOrders: vi.fn(),
    OrderError,
  };
});

vi.mock('@/services/cart', () => ({
  getCartWithPersonalPrices: vi.fn(),
}));

vi.mock('@/services/loyalty', () => {
  class LoyaltyError extends Error {
    message: string;
    constructor(message: string) {
      super(message);
      this.message = message;
    }
  }
  return { spendPoints: vi.fn(), LoyaltyError };
});

vi.mock('@/services/idempotency', () => ({
  getIdempotentResponse: vi.fn().mockResolvedValue(null),
  setIdempotentResponse: vi.fn(),
}));

vi.mock('@/validators/order', () => ({
  checkoutSchema: { safeParse: vi.fn() },
  guestCheckoutSchema: { safeParse: vi.fn() },
  orderFilterSchema: { safeParse: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findMany: vi.fn() } },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST } from './route';
import { getUserOrders, createOrder } from '@/services/order';
import { getCartWithPersonalPrices } from '@/services/cart';
import { orderFilterSchema, checkoutSchema } from '@/validators/order';

const mockGetUserOrders = getUserOrders as ReturnType<typeof vi.fn>;
const mockCreateOrder = createOrder as ReturnType<typeof vi.fn>;
const mockGetCart = getCartWithPersonalPrices as ReturnType<typeof vi.fn>;
const mockOrderFilterParse = orderFilterSchema.safeParse as ReturnType<typeof vi.fn>;
const mockCheckoutParse = checkoutSchema.safeParse as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'client' } };

describe('GET /api/v1/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated orders', async () => {
    mockOrderFilterParse.mockReturnValue({ success: true, data: { page: 1, limit: 10 } });
    mockGetUserOrders.mockResolvedValue({ orders: [{ id: 1 }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/orders?page=1&limit=10');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([{ id: 1 }]);
  });

  it('returns 400 on filter validation error', async () => {
    mockOrderFilterParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } });
    const req = new NextRequest('http://localhost/api/v1/orders');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockOrderFilterParse.mockReturnValue({ success: true, data: { page: 1, limit: 10 } });
    mockGetUserOrders.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates order for authenticated user', async () => {
    mockCheckoutParse.mockReturnValue({
      success: true,
      data: { paymentMethod: 'cash', loyaltyPointsToSpend: 0 },
    });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: null,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: null, isPromo: false },
      },
    ]);
    mockCreateOrder.mockResolvedValue({ id: 1, orderNumber: 'ORD-001' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'cash' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 when cart is empty', async () => {
    mockCheckoutParse.mockReturnValue({ success: true, data: { paymentMethod: 'cash' } });
    mockGetCart.mockResolvedValue([]);
    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockCheckoutParse.mockReturnValue({ success: true, data: { paymentMethod: 'cash' } });
    mockGetCart.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on checkout validation error', async () => {
    mockCheckoutParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad field' }] } });
    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns cached response when idempotency key exists', async () => {
    const { getIdempotentResponse } = await import('@/services/idempotency');
    vi.mocked(getIdempotentResponse).mockResolvedValue(JSON.stringify({ success: true, data: { id: 99 } }));
    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json', 'x-idempotency-key': 'key-123' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(99);
  });

  it('uses wholesale price for wholesaler user', async () => {
    const wholesalerCtx = { user: { id: 1, email: 'test@test.com', role: 'wholesaler' } };
    mockCheckoutParse.mockReturnValue({
      success: true,
      data: { paymentMethod: 'cash', loyaltyPointsToSpend: 0 },
    });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: null,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: 80, isPromo: false },
      },
    ]);
    mockCreateOrder.mockResolvedValue({ id: 2, orderNumber: 'ORD-002' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'cash' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, wholesalerCtx as any);
    expect(res.status).toBe(201);
    expect(mockCreateOrder).toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ price: 80 })]),
      'wholesale'
    );
  });

  it('uses personal price when available', async () => {
    mockCheckoutParse.mockReturnValue({
      success: true,
      data: { paymentMethod: 'cash', loyaltyPointsToSpend: 0 },
    });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: 50,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: 80, isPromo: false },
      },
    ]);
    mockCreateOrder.mockResolvedValue({ id: 3, orderNumber: 'ORD-003' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'cash' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    expect(mockCreateOrder).toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ price: 50 })]),
      'retail'
    );
  });

  it('handles loyalty points error gracefully', async () => {
    const { LoyaltyError } = await import('@/services/loyalty');
    const { spendPoints } = await import('@/services/loyalty');
    vi.mocked(spendPoints).mockRejectedValue(new LoyaltyError('Insufficient points'));

    mockCheckoutParse.mockReturnValue({
      success: true,
      data: { paymentMethod: 'cash', loyaltyPointsToSpend: 500 },
    });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: null,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: null, isPromo: false },
      },
    ]);
    mockCreateOrder.mockResolvedValue({ id: 4, orderNumber: 'ORD-004' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'cash' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.loyaltyPointsError).toBe('Insufficient points');
  });

  it('sets idempotency response for authenticated order', async () => {
    const { setIdempotentResponse, getIdempotentResponse } = await import('@/services/idempotency');
    vi.mocked(getIdempotentResponse).mockResolvedValue(null);

    mockCheckoutParse.mockReturnValue({
      success: true,
      data: { paymentMethod: 'online', loyaltyPointsToSpend: 0 },
    });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: null,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: null, isPromo: false },
      },
    ]);
    mockCreateOrder.mockResolvedValue({ id: 5, orderNumber: 'ORD-005' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'online' }),
      headers: { 'Content-Type': 'application/json', 'x-idempotency-key': 'idem-key' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.paymentRequired).toBe(true);
    expect(setIdempotentResponse).toHaveBeenCalledWith('idem-key', expect.any(String));
  });

  it('silently ignores non-LoyaltyError when spending points fails', async () => {
    const { spendPoints } = await import('@/services/loyalty');
    vi.mocked(spendPoints).mockRejectedValue(new Error('unexpected DB error'));

    mockCheckoutParse.mockReturnValue({
      success: true,
      data: { paymentMethod: 'cash', loyaltyPointsToSpend: 100 },
    });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: null,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: null, isPromo: false },
      },
    ]);
    mockCreateOrder.mockResolvedValue({ id: 6, orderNumber: 'ORD-006' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'cash' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.loyaltyPointsError).toBeUndefined();
    expect(json.data.paymentRequired).toBe(false);
  });

  it('handles OrderError with custom status code', async () => {
    const { OrderError } = await import('@/services/order');
    mockCheckoutParse.mockReturnValue({ success: true, data: { paymentMethod: 'cash' } });
    mockGetCart.mockResolvedValue([
      {
        personalPrice: null,
        quantity: 1,
        product: { id: 1, code: 'P1', name: 'Product', priceRetail: 100, priceWholesale: null, isPromo: false },
      },
    ]);
    mockCreateOrder.mockRejectedValue(new OrderError('Order limit exceeded', 429));

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'cash' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(429);
  });
});

describe('POST /api/v1/orders (guest checkout)', () => {
  const guestCtx = { user: null };

  beforeEach(() => vi.clearAllMocks());

  it('creates order for guest user', async () => {
    const { guestCheckoutSchema } = await import('@/validators/order');
    const mockGuestParse = guestCheckoutSchema.safeParse as ReturnType<typeof vi.fn>;
    mockGuestParse.mockReturnValue({
      success: true,
      data: {
        paymentMethod: 'cash',
        items: [{ productId: 1, quantity: 2 }],
        name: 'Guest',
        phone: '+380123456789',
      },
    });

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 1, code: 'P1', name: 'Product', priceRetail: 100, isPromo: false, quantity: 10 },
    ] as any);
    mockCreateOrder.mockResolvedValue({ id: 10, orderNumber: 'ORD-010' });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 2 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, guestCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.paymentRequired).toBe(false);
  });

  it('returns 400 on guest validation error', async () => {
    const { guestCheckoutSchema } = await import('@/validators/order');
    const mockGuestParse = guestCheckoutSchema.safeParse as ReturnType<typeof vi.fn>;
    mockGuestParse.mockReturnValue({ success: false, error: { issues: [{ message: 'missing phone' }] } });

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, guestCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when guest product not found', async () => {
    const { guestCheckoutSchema } = await import('@/validators/order');
    const mockGuestParse = guestCheckoutSchema.safeParse as ReturnType<typeof vi.fn>;
    mockGuestParse.mockReturnValue({
      success: true,
      data: {
        paymentMethod: 'cash',
        items: [{ productId: 999, quantity: 1 }],
      },
    });

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: 999, quantity: 1 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, guestCtx as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('999');
  });

  it('returns 400 when product has insufficient quantity', async () => {
    const { guestCheckoutSchema } = await import('@/validators/order');
    const mockGuestParse = guestCheckoutSchema.safeParse as ReturnType<typeof vi.fn>;
    mockGuestParse.mockReturnValue({
      success: true,
      data: {
        paymentMethod: 'cash',
        items: [{ productId: 1, quantity: 50 }],
      },
    });

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 1, code: 'P1', name: 'Product', priceRetail: 100, isPromo: false, quantity: 5 },
    ] as any);

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 50 }] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, guestCtx as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Product');
  });

  it('sets idempotency response for guest order', async () => {
    const { guestCheckoutSchema } = await import('@/validators/order');
    const mockGuestParse = guestCheckoutSchema.safeParse as ReturnType<typeof vi.fn>;
    mockGuestParse.mockReturnValue({
      success: true,
      data: {
        paymentMethod: 'online',
        items: [{ productId: 1, quantity: 1 }],
      },
    });

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 1, code: 'P1', name: 'Product', priceRetail: 100, isPromo: false, quantity: 10 },
    ] as any);
    mockCreateOrder.mockResolvedValue({ id: 11, orderNumber: 'ORD-011' });

    const { setIdempotentResponse, getIdempotentResponse } = await import('@/services/idempotency');
    vi.mocked(getIdempotentResponse).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: 1, quantity: 1 }] }),
      headers: { 'Content-Type': 'application/json', 'x-idempotency-key': 'guest-idem' },
    });
    const res = await POST(req, guestCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.paymentRequired).toBe(true);
    expect(setIdempotentResponse).toHaveBeenCalledWith('guest-idem', expect.any(String));
  });
});
