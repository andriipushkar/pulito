import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/services/cart', () => ({
  addToCart: vi.fn(),
  clearCart: vi.fn(),
  mergeCart: vi.fn(),
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
}));

import { addToCartAction, clearCartAction, mergeCartAction } from './cart';
import { addToCart, clearCart, mergeCart } from '@/services/cart';
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

describe('addToCartAction', () => {
  it('adds item to cart for authenticated user', async () => {
    (addToCart as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

    const formData = new FormData();
    formData.set('productId', '5');
    formData.set('quantity', '2');

    const result = await addToCartAction({ success: false }, formData);
    expect(result.success).toBe(true);
    expect(addToCart).toHaveBeenCalledWith(1, 5, 2);
  });

  it('returns error for unauthenticated user', async () => {
    (cookies as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    });

    const formData = new FormData();
    formData.set('productId', '5');
    formData.set('quantity', '1');

    const result = await addToCartAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('авторизуватися');
  });

  it('validates input', async () => {
    const formData = new FormData();
    formData.set('productId', '-1');
    formData.set('quantity', '1');

    const result = await addToCartAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles service errors', async () => {
    (addToCart as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Товар не знайдено'));

    const formData = new FormData();
    formData.set('productId', '99');
    formData.set('quantity', '1');

    const result = await addToCartAction({ success: false }, formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Товар не знайдено');
  });
});

describe('clearCartAction', () => {
  it('clears cart for authenticated user', async () => {
    (clearCart as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await clearCartAction();
    expect(result.success).toBe(true);
    expect(clearCart).toHaveBeenCalledWith(1);
  });

  it('returns error when not authenticated', async () => {
    (cookies as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    });

    const result = await clearCartAction();
    expect(result.success).toBe(false);
  });
});

describe('mergeCartAction', () => {
  it('merges local cart items', async () => {
    (mergeCart as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const items = [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }];
    const result = await mergeCartAction(items);
    expect(result.success).toBe(true);
    expect(mergeCart).toHaveBeenCalledWith(1, items);
  });

  it('validates items schema', async () => {
    const result = await mergeCartAction([{ productId: -1, quantity: 0 }]);
    expect(result.success).toBe(false);
  });

  it('returns error when not authenticated', async () => {
    (cookies as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue(undefined),
    });

    const result = await mergeCartAction([{ productId: 1, quantity: 1 }]);
    expect(result.success).toBe(false);
  });
});
