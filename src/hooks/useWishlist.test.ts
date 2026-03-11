// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockGet = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
  },
}));

const mockUser = { current: null as { id: number } | null };

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

import { useWishlist } from './useWishlist';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockUser.current = null;
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWishlist', () => {
  it('returns 0 wishlistCount initially for anonymous user', async () => {
    const { result } = renderHook(() => useWishlist());

    // Let the microtask (Promise.resolve().then) run
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(0);
  });

  it('reads wishlist count from localStorage for anonymous user', async () => {
    localStorage.setItem('clean-shop-wishlist', JSON.stringify([1, 2, 3]));

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(3);
  });

  it('fetches wishlist count from API for logged-in user', async () => {
    mockUser.current = { id: 1 };
    mockGet.mockResolvedValue({ success: true, data: { count: 5 } });

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGet).toHaveBeenCalledWith('/api/v1/me/wishlists/count');
    expect(result.current.wishlistCount).toBe(5);
  });

  it('handles API failure silently', async () => {
    mockUser.current = { id: 1 };
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(0);
  });

  it('handles invalid localStorage data gracefully', async () => {
    localStorage.setItem('clean-shop-wishlist', 'not-json');

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(0);
  });

  it('handles non-array localStorage data', async () => {
    localStorage.setItem('clean-shop-wishlist', JSON.stringify({ foo: 'bar' }));

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(0);
  });

  it('handles null localStorage value', async () => {
    // Don't set anything in localStorage

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(0);
  });

  it('clears interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('handles unsuccessful API response', async () => {
    mockUser.current = { id: 1 };
    mockGet.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(0);
  });
});
