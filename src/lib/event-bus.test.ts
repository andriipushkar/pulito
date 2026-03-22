import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  publish: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { on, emit, type DomainEvent } from './event-bus';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventBus', () => {
  it('emit calls registered handlers', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    on('order.created', handler);

    const event: DomainEvent = {
      type: 'order.created',
      payload: { orderId: 1, userId: 10, totalAmount: 500 },
    };

    await emit(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('handlers for different event types do not interfere', async () => {
    const orderHandler = vi.fn().mockResolvedValue(undefined);
    const userHandler = vi.fn().mockResolvedValue(undefined);

    on('order.completed', orderHandler);
    on('user.registered', userHandler);

    const event: DomainEvent = {
      type: 'order.completed',
      payload: { orderId: 1, userId: 10 },
    };

    await emit(event);

    expect(orderHandler).toHaveBeenCalledWith(event);
    expect(userHandler).not.toHaveBeenCalled();
  });

  it('errors in one handler do not block others', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('boom'));
    const succeedingHandler = vi.fn().mockResolvedValue(undefined);

    on('product.updated', failingHandler);
    on('product.updated', succeedingHandler);

    const event: DomainEvent = {
      type: 'product.updated',
      payload: { productId: 42 },
    };

    await emit(event);

    expect(failingHandler).toHaveBeenCalledWith(event);
    expect(succeedingHandler).toHaveBeenCalledWith(event);
  });

  it('Redis publish is called on emit', async () => {
    mockRedis.publish.mockResolvedValue(1);

    const event: DomainEvent = {
      type: 'user.registered',
      payload: { userId: 5, email: 'test@example.com' },
    };

    await emit(event);

    expect(mockRedis.publish).toHaveBeenCalledWith(
      'domain-events',
      JSON.stringify(event),
    );
  });
});
