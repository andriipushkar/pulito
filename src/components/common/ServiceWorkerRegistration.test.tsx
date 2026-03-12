// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import ServiceWorkerRegistration from './ServiceWorkerRegistration';

describe('ServiceWorkerRegistration', () => {
  let mockRegister: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let originalSW: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUpdate = vi.fn();
    mockRegister = vi.fn().mockResolvedValue({
      update: mockUpdate,
      addEventListener: vi.fn(),
    });
    originalSW = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    if (originalSW) {
      Object.defineProperty(navigator, 'serviceWorker', originalSW);
    } else {
      try {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: undefined,
          writable: true,
          configurable: true,
        });
      } catch { /* ignore */ }
    }
  });

  it('renders null (no visible output)', () => {
    const { container } = render(<ServiceWorkerRegistration />);
    expect(container.innerHTML).toBe('');
  });

  it('does not register SW when not in production', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister, addEventListener: vi.fn() },
      writable: true,
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);
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
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  it('registers SW and sets up update interval in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister, addEventListener: vi.fn() },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      render(<ServiceWorkerRegistration />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRegister).toHaveBeenCalledWith('/sw.js');

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('logs error when SW registration fails in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const regError = new Error('Registration failed');

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockRejectedValue(regError), addEventListener: vi.fn() },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      render(<ServiceWorkerRegistration />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('SW registration failed:', regError);
    consoleErrorSpy.mockRestore();
  });
});
