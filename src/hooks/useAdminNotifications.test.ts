// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

let mockToken: string | null = 'test-token';
const mockPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  getAccessToken: () => mockToken,
  // Hook hits /admin/sse-grant first to set the HttpOnly cookie the
  // EventSource connection relies on; only connects when the grant succeeds.
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
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

// Mount the hook and wait for the async grant → EventSource connection.
async function mountConnected() {
  const hook = renderHook(() => useAdminNotifications());
  await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
  return { ...hook, es: MockEventSource.instances[0] };
}

describe('useAdminNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    mockToken = 'test-token';
    mockPost.mockResolvedValue({ success: true });
    (global as Record<string, unknown>).EventSource = MockEventSource;
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).EventSource;
  });

  it('starts with empty notifications', () => {
    const { result } = renderHook(() => useAdminNotifications());
    expect(result.current.notifications).toEqual([]);
  });

  it('connects to EventSource after grant succeeds', async () => {
    const { es } = await mountConnected();
    expect(es.url).toContain('/api/v1/admin/notifications/stream');
    expect(mockPost).toHaveBeenCalledWith('/api/v1/admin/sse-grant', {});
  });

  it('does not connect when token is null', () => {
    mockToken = null;
    renderHook(() => useAdminNotifications());
    expect(MockEventSource.instances).toHaveLength(0);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does not connect when grant is denied', async () => {
    mockPost.mockResolvedValue({ success: false });
    renderHook(() => useAdminNotifications());
    // Give the async connect() a tick to resolve the (denied) grant.
    await act(async () => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('receives new_order notifications', async () => {
    const { result, es } = await mountConnected();

    act(() => {
      es.emit('new_order', { latest: { orderNumber: '42', totalAmount: 1500 } });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('new_order');
    expect(result.current.notifications[0].message).toContain('42');
    expect(result.current.notifications[0].message).toContain('1500');
  });

  it('receives new_review notifications', async () => {
    const { result, es } = await mountConnected();

    act(() => {
      es.emit('new_review', { count: 5 });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('new_review');
    expect(result.current.notifications[0].message).toContain('5');
  });

  it('dismiss removes a specific notification', async () => {
    const { result, es } = await mountConnected();

    act(() => {
      es.emit('new_order', { latest: { orderNumber: '1', totalAmount: 100 } });
    });

    const notifId = result.current.notifications[0].id;

    act(() => {
      result.current.dismiss(notifId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('dismissAll clears all notifications', async () => {
    const { result, es } = await mountConnected();

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

  it('sets connected state on open event', async () => {
    const { result, es } = await mountConnected();

    act(() => {
      es.emit('open');
    });

    expect(result.current.connected).toBe(true);
  });

  it('closes EventSource on unmount', async () => {
    const { unmount, es } = await mountConnected();

    unmount();

    expect(es.closed).toBe(true);
  });

  it('limits notifications to 20', async () => {
    const { result, es } = await mountConnected();

    act(() => {
      for (let i = 0; i < 25; i++) {
        es.emit('new_order', { latest: { orderNumber: String(i), totalAmount: 100 } });
      }
    });

    expect(result.current.notifications.length).toBeLessThanOrEqual(20);
  });
});
