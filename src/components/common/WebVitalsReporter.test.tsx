// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUseReportWebVitals = vi.hoisted(() => vi.fn());

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: mockUseReportWebVitals,
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

  it('calls useReportWebVitals with a callback', () => {
    render(<WebVitalsReporter />);
    expect(mockUseReportWebVitals).toHaveBeenCalledWith(expect.any(Function));
  });

  it('sends metric via sendBeacon when available', () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    });

    render(<WebVitalsReporter />);
    const callback = mockUseReportWebVitals.mock.calls[0][0];

    callback({ name: 'LCP', value: 100 });

    expect(mockSendBeacon).toHaveBeenCalledWith(
      '/api/v1/metrics',
      expect.any(String),
    );
    const body = JSON.parse(mockSendBeacon.mock.calls[0][1]);
    expect(body.metric).toBe('LCP');
    expect(body.value).toBe(100);
    expect(body.route).toBe(window.location.pathname);
  });

  it('falls back to fetch when sendBeacon is not available', () => {
    const originalSendBeacon = navigator.sendBeacon;
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    global.fetch = vi.fn().mockResolvedValue({});

    render(<WebVitalsReporter />);
    const callback = mockUseReportWebVitals.mock.calls[0][0];

    callback({ name: 'FID', value: 50 });

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/metrics', {
      method: 'POST',
      body: expect.any(String),
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      keepalive: true,
    });

    // Restore
    Object.defineProperty(navigator, 'sendBeacon', {
      value: originalSendBeacon,
      writable: true,
      configurable: true,
    });
  });

  it('does not throw when fetch fallback fails', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'));

    render(<WebVitalsReporter />);
    const callback = mockUseReportWebVitals.mock.calls[0][0];

    expect(() => callback({ name: 'CLS', value: 0.1 })).not.toThrow();
  });
});
