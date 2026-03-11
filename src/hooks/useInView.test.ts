// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createElement, useEffect } from 'react';
import { render } from '@testing-library/react';
import { useInView } from './useInView';

let observeCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
let mockObserverInstance: IntersectionObserver;

beforeEach(() => {
  vi.clearAllMocks();

  const MockIntersectionObserver = vi.fn(function (this: any, callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    observeCallback = callback;
    this.observe = mockObserve;
    this.unobserve = mockUnobserve;
    this.disconnect = mockDisconnect;
    this.root = null;
    this.rootMargin = '';
    this.thresholds = [];
    this.takeRecords = vi.fn();
    mockObserverInstance = this;
  });

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
});

describe('useInView', () => {
  it('returns ref and isInView=false initially', () => {
    const { result } = renderHook(() => useInView());
    const [ref, isInView] = result.current;
    expect(ref).toBeDefined();
    expect(isInView).toBe(false);
  });

  it('does not create observer when ref.current is null', () => {
    renderHook(() => useInView());
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('creates observer and observes when ref is attached to a DOM element', () => {
    function TestComponent() {
      const [ref, isInView] = useInView({ threshold: 0.5 });
      return createElement('div', { ref, 'data-testid': 'target', 'data-inview': String(isInView) });
    }

    const { getByTestId } = render(createElement(TestComponent));
    const el = getByTestId('target');

    expect(mockObserve).toHaveBeenCalledWith(el);
    expect(globalThis.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      { threshold: 0.5 }
    );
  });

  it('sets isInView to true and unobserves when entry is intersecting', () => {
    function TestComponent() {
      const [ref, isInView] = useInView();
      return createElement('div', { ref, 'data-testid': 'target', 'data-inview': String(isInView) });
    }

    const { getByTestId } = render(createElement(TestComponent));
    const el = getByTestId('target');

    expect(getByTestId('target').getAttribute('data-inview')).toBe('false');

    // Simulate intersection
    act(() => {
      observeCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        mockObserverInstance
      );
    });

    expect(getByTestId('target').getAttribute('data-inview')).toBe('true');
    expect(mockUnobserve).toHaveBeenCalledWith(el);
  });

  it('does not set isInView when entry is not intersecting', () => {
    function TestComponent() {
      const [ref, isInView] = useInView();
      return createElement('div', { ref, 'data-testid': 'target', 'data-inview': String(isInView) });
    }

    const { getByTestId } = render(createElement(TestComponent));

    act(() => {
      observeCallback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        mockObserverInstance
      );
    });

    expect(getByTestId('target').getAttribute('data-inview')).toBe('false');
    expect(mockUnobserve).not.toHaveBeenCalled();
  });

  it('disconnects observer on unmount', () => {
    function TestComponent() {
      const [ref] = useInView();
      return createElement('div', { ref, 'data-testid': 'target' });
    }

    const { unmount } = render(createElement(TestComponent));
    expect(mockDisconnect).not.toHaveBeenCalled();

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
