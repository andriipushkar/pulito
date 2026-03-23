import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOn = vi.fn();

vi.mock('./event-bus', () => ({
  on: (...args: unknown[]) => mockOn(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('registerEventHandlers', () => {
  it('registers handlers for expected event types', async () => {
    // Re-mock after resetModules
    vi.mock('./event-bus', () => ({
      on: (...args: unknown[]) => mockOn(...args),
    }));
    const { registerEventHandlers } = await import('./event-handlers');
    registerEventHandlers();

    const registeredEvents = mockOn.mock.calls.map(([type]: [string]) => type);
    expect(registeredEvents).toContain('order.created');
    expect(registeredEvents).toContain('order.completed');
    expect(registeredEvents).toContain('product.stock_changed');
    expect(registeredEvents).toContain('user.registered');
  });

  it('registers exactly 4 event handlers', async () => {
    vi.mock('./event-bus', () => ({
      on: (...args: unknown[]) => mockOn(...args),
    }));
    const { registerEventHandlers } = await import('./event-handlers');
    registerEventHandlers();
    expect(mockOn).toHaveBeenCalledTimes(4);
  });

  it('handlers are async functions', async () => {
    vi.mock('./event-bus', () => ({
      on: (...args: unknown[]) => mockOn(...args),
    }));
    const { registerEventHandlers } = await import('./event-handlers');
    registerEventHandlers();

    for (const call of mockOn.mock.calls) {
      const handler = call[1];
      expect(typeof handler).toBe('function');
    }
  });

  it('order.created handler ignores events of wrong type', async () => {
    vi.mock('./event-bus', () => ({
      on: (...args: unknown[]) => mockOn(...args),
    }));
    const { registerEventHandlers } = await import('./event-handlers');
    registerEventHandlers();

    const orderCreatedHandler = mockOn.mock.calls.find(
      ([type]: [string]) => type === 'order.created'
    )?.[1];

    // Should not throw when called with wrong type
    await expect(
      orderCreatedHandler({ type: 'user.registered', payload: {} })
    ).resolves.toBeUndefined();
  });
});
