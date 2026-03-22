import { redis } from './redis';
import { logger } from './logger';

export type DomainEvent =
  | { type: 'order.created'; payload: { orderId: number; userId: number | null; totalAmount: number } }
  | { type: 'order.completed'; payload: { orderId: number; userId: number } }
  | { type: 'order.cancelled'; payload: { orderId: number; userId: number | null } }
  | { type: 'product.updated'; payload: { productId: number } }
  | { type: 'product.stock_changed'; payload: { productId: number; newQuantity: number } }
  | { type: 'user.registered'; payload: { userId: number; email: string } }
  | { type: 'review.created'; payload: { reviewId: number; productId: number; userId: number } }
  | { type: 'subscription.renewed'; payload: { subscriptionId: number; orderId: number } };

type EventHandler = (event: DomainEvent) => Promise<void>;

const handlers: Map<string, EventHandler[]> = new Map();

export function on(eventType: string, handler: EventHandler) {
  const existing = handlers.get(eventType) || [];
  existing.push(handler);
  handlers.set(eventType, existing);
}

export async function emit(event: DomainEvent): Promise<void> {
  // Publish to Redis for cross-process communication
  try {
    await redis.publish('domain-events', JSON.stringify(event));
  } catch {
    // Redis unavailable — process locally only
  }

  // Process local handlers
  const eventHandlers = handlers.get(event.type) || [];
  await Promise.allSettled(
    eventHandlers.map(handler =>
      handler(event).catch(err =>
        logger.error(`[EventBus] Handler error for ${event.type}`, { error: String(err) })
      )
    )
  );
}
