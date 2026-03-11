// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import AriaLiveRegion, { announce } from './AriaLiveRegion';

describe('AriaLiveRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders with aria-live attribute', () => {
    const { container } = render(<AriaLiveRegion />);
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
  });

  it('has role="status"', () => {
    const { getAllByRole } = render(<AriaLiveRegion />);
    expect(getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('displays announcement when announce() is called', () => {
    const { container } = render(<AriaLiveRegion />);
    act(() => {
      announce('Item added to cart');
    });
    expect(container.textContent).toContain('Item added to cart');
  });

  it('displays multiple announcements', () => {
    const { container } = render(<AriaLiveRegion />);
    act(() => {
      announce('First message');
      announce('Second message');
    });
    expect(container.textContent).toContain('First message');
    expect(container.textContent).toContain('Second message');
  });

  it('cleans up old announcements after timeout', () => {
    const { container } = render(<AriaLiveRegion />);
    act(() => {
      announce('Temporary message');
    });
    expect(container.textContent).toContain('Temporary message');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.textContent).not.toContain('Temporary message');
  });

  it('announce does nothing when no AriaLiveRegion is mounted', () => {
    // Don't render the component, just call announce
    // Should not throw
    expect(() => announce('No component mounted')).not.toThrow();
  });

  it('unregisters callback on unmount', () => {
    const { container, unmount } = render(<AriaLiveRegion />);
    act(() => {
      announce('Before unmount');
    });
    expect(container.textContent).toContain('Before unmount');

    unmount();

    // After unmount, announce should do nothing
    expect(() => announce('After unmount')).not.toThrow();
  });

  it('renders announcements with span elements', () => {
    const { container } = render(<AriaLiveRegion />);
    act(() => {
      announce('Test span');
    });
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0].textContent).toBe('Test span');
  });
});
