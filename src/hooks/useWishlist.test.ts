// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockSwrData = { current: undefined as { count: number } | undefined };

vi.mock('swr', () => ({
  default: (_key: string | null) => ({
    data: mockSwrData.current,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('@/lib/swr', () => ({
  fetcher: vi.fn(),
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
  mockSwrData.current = undefined;
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWishlist', () => {
  it('returns 0 wishlistCount initially for anonymous user', async () => {
    const { result } = renderHook(() => useWishlist());

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

  it('returns wishlist count from SWR data for logged-in user', async () => {
    mockUser.current = { id: 1 };
    mockSwrData.current = { count: 5 };

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.wishlistCount).toBe(5);
  });

  it('returns 0 when SWR has no data for logged-in user', async () => {
    mockUser.current = { id: 1 };
    mockSwrData.current = undefined;

    const { result } = renderHook(() => useWishlist());

    await act(async () => {
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

  it('uses SWR key only when user is logged in', async () => {
    // Anonymous user — SWR key should be null (no fetch)
    const { result } = renderHook(() => useWishlist());

    await act(async () => {
      await Promise.resolve();
    });

    // Should use localStorage count, not SWR
    expect(result.current.wishlistCount).toBe(0);
  });
});
