/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStream } from './useChatStream';

vi.mock('@/lib/api-client', () => ({
  getAccessToken: vi.fn(() => 'test-token'),
}));

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  close = vi.fn();

  // Helper to simulate events
  emit(event: string, data: unknown) {
    const handlers = this.listeners[event] || [];
    for (const handler of handlers) {
      handler({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useChatStream', () => {
  it('does not connect when roomId is null', () => {
    renderHook(() => useChatStream({ roomId: null }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('connects to SSE endpoint with room ID and token', () => {
    renderHook(() => useChatStream({ roomId: 42 }));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/v1/chat/42/stream?token=test-token');
  });

  it('sets connected=true on connected event', () => {
    const { result } = renderHook(() => useChatStream({ roomId: 1 }));

    act(() => {
      MockEventSource.instances[0].emit('connected', { roomId: 1 });
    });

    expect(result.current.connected).toBe(true);
  });

  it('adds new messages from SSE events', () => {
    const { result } = renderHook(() => useChatStream({ roomId: 1 }));

    const msg = {
      id: 100,
      roomId: 1,
      senderType: 'agent',
      senderId: 2,
      content: 'Hello!',
      attachmentUrl: null,
      isRead: false,
      createdAt: '2026-03-25T00:00:00Z',
    };

    act(() => {
      MockEventSource.instances[0].emit('message', msg);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello!');
  });

  it('deduplicates messages by id', () => {
    const { result } = renderHook(() => useChatStream({ roomId: 1 }));

    const msg = {
      id: 100,
      roomId: 1,
      senderType: 'agent',
      senderId: 2,
      content: 'Hi',
      attachmentUrl: null,
      isRead: false,
      createdAt: '2026-03-25T00:00:00Z',
    };

    act(() => {
      MockEventSource.instances[0].emit('message', msg);
      MockEventSource.instances[0].emit('message', msg);
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it('calls onMessage callback', () => {
    const onMessage = vi.fn();
    renderHook(() => useChatStream({ roomId: 1, onMessage }));

    const msg = {
      id: 101,
      roomId: 1,
      senderType: 'customer',
      senderId: 1,
      content: 'Test',
      attachmentUrl: null,
      isRead: false,
      createdAt: '2026-03-25T00:00:00Z',
    };

    act(() => {
      MockEventSource.instances[0].emit('message', msg);
    });

    expect(onMessage).toHaveBeenCalledWith(msg);
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useChatStream({ roomId: 1 }));
    const es = MockEventSource.instances[0];

    unmount();
    expect(es.close).toHaveBeenCalled();
  });
});
