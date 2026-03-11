// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import ServiceWorkerRegistration from './ServiceWorkerRegistration';

describe('ServiceWorkerRegistration', () => {
  let mockRegister: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let originalSW: PropertyDescriptor | undefined;
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUpdate = vi.fn();
    mockRegister = vi.fn().mockResolvedValue({ update: mockUpdate });
    originalSW = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Restore serviceWorker
    if (originalSW) {
      Object.defineProperty(navigator, 'serviceWorker', originalSW);
    } else {
      // @ts-expect-error cleanup
      delete (navigator as any).serviceWorker;
    }
    // Restore NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  it('renders null (no visible output)', () => {
    const { container } = render(<ServiceWorkerRegistration />);
    expect(container.innerHTML).toBe('');
  });

  it('does not register SW when not in production', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);
    // NODE_ENV is 'test', so it should not register
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not register when serviceWorker is not in navigator', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns null from render', () => {
    const { container } = render(<ServiceWorkerRegistration />);
    expect(container.childElementCount).toBe(0);
  });

  it('does not throw when navigator has no serviceWorker property at all', () => {
    const desc = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    // @ts-expect-error deleting for test
    delete (navigator as any).serviceWorker;

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();

    if (desc) {
      Object.defineProperty(navigator, 'serviceWorker', desc);
    }
  });

  it('registers SW and sets up update interval in production', async () => {
    // Override NODE_ENV to production
    process.env.NODE_ENV = 'production';

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      render(<ServiceWorkerRegistration />);
    });

    // Flush the microtask queue for the .then()
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRegister).toHaveBeenCalledWith('/sw.js');

    // Advance timer by 1 hour to trigger the interval
    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Advance another hour
    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('logs error when SW registration fails in production', async () => {
    process.env.NODE_ENV = 'production';
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const regError = new Error('Registration failed');

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockRejectedValue(regError) },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      render(<ServiceWorkerRegistration />);
    });

    // Flush microtask queue for the .catch()
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('SW registration failed:', regError);
    consoleErrorSpy.mockRestore();
  });
});
