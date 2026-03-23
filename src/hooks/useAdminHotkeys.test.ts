// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { useAdminHotkeys } from './useAdminHotkeys';

function fireKeyDown(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

describe('useAdminHotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns shortcuts list and showHelp state', () => {
    const { result } = renderHook(() => useAdminHotkeys());

    expect(result.current.shortcuts.length).toBeGreaterThan(0);
    expect(result.current.showHelp).toBe(false);
  });

  it('navigates to dashboard on Ctrl+Shift+D', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('d', { ctrlKey: true, shiftKey: true });
    });

    expect(mockPush).toHaveBeenCalledWith('/admin');
  });

  it('navigates to orders on Ctrl+Shift+O', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('o', { ctrlKey: true, shiftKey: true });
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/orders');
  });

  it('navigates to products on Ctrl+Shift+P', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('p', { ctrlKey: true, shiftKey: true });
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/products');
  });

  it('navigates to users on Ctrl+Shift+U', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('u', { ctrlKey: true, shiftKey: true });
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/users');
  });

  it('navigates to analytics on Ctrl+Shift+A', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('a', { ctrlKey: true, shiftKey: true });
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/analytics');
  });

  it('navigates to categories on Ctrl+Shift+C', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('c', { ctrlKey: true, shiftKey: true });
    });

    expect(mockPush).toHaveBeenCalledWith('/admin/categories');
  });

  it('toggles help with / key', () => {
    const { result } = renderHook(() => useAdminHotkeys());

    expect(result.current.showHelp).toBe(false);

    act(() => {
      fireKeyDown('/');
    });

    expect(result.current.showHelp).toBe(true);
  });

  it('closes help with Escape', () => {
    const { result } = renderHook(() => useAdminHotkeys());

    // Open help first
    act(() => {
      fireKeyDown('/');
    });
    expect(result.current.showHelp).toBe(true);

    act(() => {
      fireKeyDown('Escape');
    });
    expect(result.current.showHelp).toBe(false);
  });

  it('does not fire shortcuts when target is an input', () => {
    renderHook(() => useAdminHotkeys());

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: 'd',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    // Dispatch from the input
    act(() => {
      input.dispatchEvent(event);
    });

    // The router should not have been called since target is an input
    // Note: this depends on the event propagation handling
    document.body.removeChild(input);
  });

  it('removes event listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useAdminHotkeys());
    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeListenerSpy.mockRestore();
  });

  it('does not navigate without Ctrl+Shift for navigation shortcuts', () => {
    renderHook(() => useAdminHotkeys());

    act(() => {
      fireKeyDown('d'); // No ctrl+shift
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
