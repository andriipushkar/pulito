import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/order', () => ({
  createOrder: vi.fn(),
  OrderError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@/services/cart', () => ({
  getCartWithPersonalPrices: vi.fn(),
}));

vi.mock('@/services/loyalty', () => ({
  spendPoints: vi.fn(),
  LoyaltyError: class extends Error {},
}));

vi.mock('@/services/idempotency', () => ({
  getIdempotentResponse: vi.fn().mockResolvedValue(null),
  setIdempotentResponse: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    loyaltyAccount: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/wholesale-price', () => ({
  resolveWholesalePrice: vi.fn(),
}));

vi.mock('@/services/token', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('@/services/auth', () => ({
  isAccessTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-token' }),
  }),
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('@/services/server-tracking', () => ({
  trackPurchase: vi.fn().mockResolvedValue(undefined),
}));

import { checkoutAction } from './checkout';
import { createOrder } from '@/services/order';
import { getCartWithPersonalPrices } from '@/services/cart';
import { verifyAccessToken } from '@/services/token';
import { cookies } from 'next/headers';

beforeEach(() => {
  vi.clearAllMocks();
  (verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({
    sub: 1,
    email: 'test@test.com',
    role: 'user',
  });
});

function makeFormData(overrides?: Record<string, string>) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    contactName: 'Test User',
    contactPhone: '+380991234567',
    contactEmail: 'test@test.com',
    deliveryMethod: 'pickup',
    paymentMethod: 'cod',
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    data.set(key, value);
  }
  return data;
}

describe('checkoutAction', () => {
  it('returns error for unauthenticated user', async () => {
    (cookies as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    });

    const result = await checkoutAction({ success: false }, makeFormData());
    expect(result.success).toBe(false);
    expect(result.error).toContain('авторизуватися');
  });

  it('validates checkout form data', async () => {
    const formData = new FormData();
    formData.set('contactName', 'A'); // too short

    const result = await checkoutAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for empty cart', async () => {
    (getCartWithPersonalPrices as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await checkoutAction({ success: false }, makeFormData());
    expect(result.success).toBe(false);
    expect(result.error).toContain('порожній');
  });

  it('creates order successfully', async () => {
    (getCartWithPersonalPrices as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        product: { id: 1, code: 'P1', name: 'Product 1', priceRetail: 100, quantity: 10, isActive: true, isPromo: false },
        quantity: 2,
        personalPrice: null,
      },
    ]);
    (createOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      orderNumber: 'ORD-001',
      totalAmount: 200,
    });

    const result = await checkoutAction({ success: false }, makeFormData());
    expect(result.success).toBe(true);
    expect(result.orderNumber).toBe('ORD-001');
  });

  it('detects insufficient stock', async () => {
    (getCartWithPersonalPrices as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        product: { id: 1, code: 'P1', name: 'Product 1', priceRetail: 100, quantity: 1, isActive: true, isPromo: false },
        quantity: 5,
        personalPrice: null,
      },
    ]);

    const result = await checkoutAction({ success: false }, makeFormData());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Недостатньо');
  });

  it('detects inactive product', async () => {
    (getCartWithPersonalPrices as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        product: { id: 1, code: 'P1', name: 'Old Product', priceRetail: 50, quantity: 10, isActive: false, isPromo: false },
        quantity: 1,
        personalPrice: null,
      },
    ]);

    const result = await checkoutAction({ success: false }, makeFormData());
    expect(result.success).toBe(false);
    expect(result.error).toContain('не доступний');
  });

  it('sets paymentRequired for online payment', async () => {
    (getCartWithPersonalPrices as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        product: { id: 1, code: 'P1', name: 'Test', priceRetail: 100, quantity: 10, isActive: true, isPromo: false },
        quantity: 1,
        personalPrice: null,
      },
    ]);
    (createOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      orderNumber: 'ORD-002',
      totalAmount: 100,
    });

    const result = await checkoutAction({ success: false }, makeFormData({ paymentMethod: 'online' }));
    expect(result.success).toBe(true);
    expect(result.paymentRequired).toBe(true);
  });
});
