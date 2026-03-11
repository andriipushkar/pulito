// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn().mockResolvedValue({ success: true });

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
    get: vi.fn(),
  },
}));

const mockUser = { current: null as { id: number } | null };

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

import { useRecentlyViewed } from './useRecentlyViewed';

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.current = null;
  localStorage.clear();
});

describe('useRecentlyViewed', () => {
  it('returns empty ids initially', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.ids).toEqual([]);
  });

  it('loads ids from localStorage', () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([5, 3, 1]));
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.ids).toEqual([5, 3, 1]);
  });

  it('addItem adds a product id to the beginning', () => {
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      result.current.addItem(10);
    });

    expect(result.current.ids).toEqual([10]);
    expect(JSON.parse(localStorage.getItem('clean-shop-recently-viewed')!)).toEqual([10]);
  });

  it('addItem moves existing id to the front', () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([1, 2, 3]));
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      result.current.addItem(2);
    });

    expect(result.current.ids[0]).toBe(2);
    expect(result.current.ids).toHaveLength(3);
  });

  it('addItem limits to MAX_ITEMS (15)', () => {
    const existing = Array.from({ length: 15 }, (_, i) => i + 1);
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify(existing));
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      result.current.addItem(100);
    });

    expect(result.current.ids).toHaveLength(15);
    expect(result.current.ids[0]).toBe(100);
    // Last item (15) should be dropped
    expect(result.current.ids).not.toContain(15);
  });

  it('addItem calls API when user is logged in', () => {
    mockUser.current = { id: 1 };
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      result.current.addItem(42);
    });

    expect(mockPost).toHaveBeenCalledWith('/api/v1/me/recently-viewed', { productId: 42 });
  });

  it('addItem does not call API when user is not logged in', () => {
    const { result } = renderHook(() => useRecentlyViewed());

    act(() => {
      result.current.addItem(42);
    });

    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/me/recently-viewed', expect.anything());
  });

  it('getItems returns current ids', () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([7, 8]));
    const { result } = renderHook(() => useRecentlyViewed());

    expect(result.current.getItems()).toEqual([7, 8]);
  });

  it('handles invalid localStorage data gracefully', () => {
    localStorage.setItem('clean-shop-recently-viewed', 'invalid-json');
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.ids).toEqual([]);
  });

  it('merges localStorage with server when user logs in', async () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([1, 2, 3]));
    mockUser.current = { id: 1 };
    mockPost.mockResolvedValue({ success: true });

    renderHook(() => useRecentlyViewed());

    // Wait for effect
    await vi.waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/me/recently-viewed/merge', { productIds: [1, 2, 3] });
    });
  });

  it('skips merge when localStorage has empty array', async () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([]));
    mockUser.current = { id: 1 };

    renderHook(() => useRecentlyViewed());

    // Wait a tick to let effect run
    await new Promise((r) => setTimeout(r, 10));

    // Should NOT call merge because localIds.length === 0
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/me/recently-viewed/merge', expect.anything());
  });

  it('skips merge when localStorage has no saved data', async () => {
    // No localStorage item set at all
    mockUser.current = { id: 1 };

    renderHook(() => useRecentlyViewed());

    await new Promise((r) => setTimeout(r, 10));

    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/me/recently-viewed/merge', expect.anything());
  });

  it('handles merge API failure gracefully (catch path)', async () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([10, 20]));
    mockUser.current = { id: 1 };
    mockPost.mockRejectedValueOnce(new Error('merge failed'));

    renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/me/recently-viewed/merge', { productIds: [10, 20] });
    });

    // Should not throw, localStorage should still have data since merge failed
    expect(localStorage.getItem('clean-shop-recently-viewed')).not.toBeNull();
  });

  it('removes localStorage after successful merge', async () => {
    localStorage.setItem('clean-shop-recently-viewed', JSON.stringify([5, 6]));
    mockUser.current = { id: 1 };
    mockPost.mockResolvedValue({ success: true });

    renderHook(() => useRecentlyViewed());

    await vi.waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/v1/me/recently-viewed/merge', { productIds: [5, 6] });
    });

    // After successful merge, localStorage should be cleared
    await vi.waitFor(() => {
      expect(localStorage.getItem('clean-shop-recently-viewed')).toBeNull();
    });
  });
});
