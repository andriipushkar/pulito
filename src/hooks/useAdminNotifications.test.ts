// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let mockToken: string | null = 'test-token';
vi.mock('@/lib/api-client', () => ({
  getAccessToken: () => mockToken,
}));

import { useAdminNotifications } from './useAdminNotifications';

class MockEventSource {
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  static instances: MockEventSource[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  close() {
    this.closed = true;
  }

  // Helper to simulate events in tests
  emit(event: string, data?: unknown) {
    const handlers = this.listeners[event] || [];
    for (const handler of handlers) {
      handler({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

describe('useAdminNotifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockEventSource.instances = [];
    mockToken = 'test-token';
    (global as Record<string, unknown>).EventSource = MockEventSource;
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).EventSource;
  });

  it('starts with empty notifications', () => {
    const { result } = renderHook(() => useAdminNotifications());
    expect(result.current.notifications).toEqual([]);
  });

  it('connects to EventSource when token is present', () => {
    renderHook(() => useAdminNotifications());
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('/api/v1/admin/notifications/stream');
    expect(MockEventSource.instances[0].url).toContain('token=test-token');
  });

  it('does not connect when token is null', () => {
    mockToken = null;
    renderHook(() => useAdminNotifications());
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('receives new_order notifications', () => {
    const { result } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('new_order', { latest: { orderNumber: '42', totalAmount: 1500 } });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('new_order');
    expect(result.current.notifications[0].message).toContain('42');
    expect(result.current.notifications[0].message).toContain('1500');
  });

  it('receives new_review notifications', () => {
    const { result } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('new_review', { count: 5 });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('new_review');
    expect(result.current.notifications[0].message).toContain('5');
  });

  it('dismiss removes a specific notification', () => {
    const { result } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('new_order', { latest: { orderNumber: '1', totalAmount: 100 } });
    });

    const notifId = result.current.notifications[0].id;

    act(() => {
      result.current.dismiss(notifId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('dismissAll clears all notifications', () => {
    const { result } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('new_order', { latest: { orderNumber: '1', totalAmount: 100 } });
      es.emit('new_review', { count: 3 });
    });

    expect(result.current.notifications.length).toBeGreaterThan(0);

    act(() => {
      result.current.dismissAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('sets connected state on open event', () => {
    const { result } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('open');
    });

    expect(result.current.connected).toBe(true);
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    unmount();

    expect(es.closed).toBe(true);
  });

  it('limits notifications to 20', () => {
    const { result } = renderHook(() => useAdminNotifications());
    const es = MockEventSource.instances[0];

    act(() => {
      for (let i = 0; i < 25; i++) {
        es.emit('new_order', { latest: { orderNumber: String(i), totalAmount: 100 } });
      }
    });

    expect(result.current.notifications.length).toBeLessThanOrEqual(20);
  });
});
