// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComparison } from './useComparison';

describe('useComparison', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty list', () => {
    const { result } = renderHook(() => useComparison());
    expect(result.current.ids).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('adds a product', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
    });

    expect(result.current.ids).toEqual([1]);
    expect(result.current.count).toBe(1);
  });

  it('removes a product', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
      result.current.add(2);
    });

    act(() => {
      result.current.remove(1);
    });

    expect(result.current.ids).toEqual([2]);
  });

  it('enforces max limit of 4', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
      result.current.add(2);
      result.current.add(3);
      result.current.add(4);
    });

    act(() => {
      result.current.add(5); // Should be ignored
    });

    expect(result.current.ids).toHaveLength(4);
    expect(result.current.isFull).toBe(true);
    expect(result.current.ids).not.toContain(5);
  });

  it('does not add duplicate products', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
    });

    act(() => {
      result.current.add(1);
    });

    expect(result.current.ids).toEqual([1]);
  });

  it('clears all products', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
      result.current.add(2);
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.ids).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('has() checks if product is in comparison', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
    });

    expect(result.current.has(1)).toBe(true);
    expect(result.current.has(2)).toBe(false);
  });

  it('toggle adds and removes', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.toggle(1);
    });

    expect(result.current.ids).toEqual([1]);

    act(() => {
      result.current.toggle(1);
    });

    expect(result.current.ids).toEqual([]);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
      result.current.add(2);
    });

    const stored = JSON.parse(localStorage.getItem('clean-shop-comparison')!);
    expect(stored).toEqual([1, 2]);
  });

  it('loads from localStorage on mount', () => {
    localStorage.setItem('clean-shop-comparison', JSON.stringify([10, 20]));

    const { result } = renderHook(() => useComparison());

    // Loaded via useEffect
    expect(result.current.ids).toEqual([10, 20]);
  });

  it('isFull is false when under limit', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
    });

    expect(result.current.isFull).toBe(false);
  });

  it('clear also clears localStorage', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.add(1);
    });

    act(() => {
      result.current.clear();
    });

    const stored = JSON.parse(localStorage.getItem('clean-shop-comparison')!);
    expect(stored).toEqual([]);
  });
});
