// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockOnLCP = vi.fn();
const mockOnCLS = vi.fn();
const mockOnFID = vi.fn();
const mockOnINP = vi.fn();
const mockOnTTFB = vi.fn();
const mockOnFCP = vi.fn();

vi.mock('web-vitals', () => ({
  onLCP: (cb: Function) => mockOnLCP(cb),
  onCLS: (cb: Function) => mockOnCLS(cb),
  onFID: (cb: Function) => mockOnFID(cb),
  onINP: (cb: Function) => mockOnINP(cb),
  onTTFB: (cb: Function) => mockOnTTFB(cb),
  onFCP: (cb: Function) => mockOnFCP(cb),
}));

import WebVitalsReporter from './WebVitalsReporter';

describe('WebVitalsReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<WebVitalsReporter />);
    expect(container.innerHTML).toBe('');
  });

  it('registers all 6 Core Web Vitals listeners', async () => {
    render(<WebVitalsReporter />);
    // Wait for dynamic import to resolve
    await vi.waitFor(() => {
      expect(mockOnLCP).toHaveBeenCalledTimes(1);
    });
    expect(mockOnCLS).toHaveBeenCalledTimes(1);
    expect(mockOnFID).toHaveBeenCalledTimes(1);
    expect(mockOnINP).toHaveBeenCalledTimes(1);
    expect(mockOnTTFB).toHaveBeenCalledTimes(1);
    expect(mockOnFCP).toHaveBeenCalledTimes(1);
  });

  it('sends metric via sendBeacon when available', async () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    });

    render(<WebVitalsReporter />);
    await vi.waitFor(() => {
      expect(mockOnLCP).toHaveBeenCalled();
    });

    // Simulate LCP metric
    const lcpCallback = mockOnLCP.mock.calls[0][0];
    lcpCallback({ name: 'LCP', value: 100 });

    expect(mockSendBeacon).toHaveBeenCalledWith('/api/v1/metrics', expect.any(String));
    const body = JSON.parse(mockSendBeacon.mock.calls[0][1]);
    expect(body.metric).toBe('LCP');
    expect(body.value).toBe(100);
  });

  it('falls back to fetch when sendBeacon is not available', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({});

    render(<WebVitalsReporter />);
    await vi.waitFor(() => {
      expect(mockOnFID).toHaveBeenCalled();
    });

    const fidCallback = mockOnFID.mock.calls[0][0];
    fidCallback({ name: 'FID', value: 50 });

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/metrics', expect.objectContaining({
      method: 'POST',
      keepalive: true,
    }));
  });

  it('does not throw when fetch fallback fails', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'));

    render(<WebVitalsReporter />);
    await vi.waitFor(() => {
      expect(mockOnCLS).toHaveBeenCalled();
    });

    const clsCallback = mockOnCLS.mock.calls[0][0];
    expect(() => clsCallback({ name: 'CLS', value: 0.1 })).not.toThrow();
  });
});
