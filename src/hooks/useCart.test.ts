// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockContextValue = {
  items: [{ productId: 1, name: 'Test', slug: 'test', code: 'T01', priceRetail: 100, priceWholesale: 80, imagePath: null, quantity: 2, maxQuantity: 10 }],
  itemCount: 2,
  total: vi.fn(() => 200),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  updateQuantity: vi.fn(),
  clearCart: vi.fn(),
};

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: vi.fn(() => mockContextValue),
  };
});

vi.mock('@/providers/CartProvider', () => ({
  CartContext: {},
}));

import { useCart } from './useCart';

describe('useCart', () => {
  it('returns cart context value', () => {
    const { result } = renderHook(() => useCart());
    expect(result.current).toBeDefined();
    expect(result.current.items).toHaveLength(1);
  });

  it('returns itemCount', () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.itemCount).toBe(2);
  });

  it('returns total function', () => {
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.total).toBe('function');
  });

  it('returns addItem function', () => {
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.addItem).toBe('function');
  });

  it('returns removeItem function', () => {
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.removeItem).toBe('function');
  });

  it('returns updateQuantity function', () => {
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.updateQuantity).toBe('function');
  });

  it('returns clearCart function', () => {
    const { result } = renderHook(() => useCart());
    expect(typeof result.current.clearCart).toBe('function');
  });
});
