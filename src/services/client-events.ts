import { prisma } from '@/lib/prisma';

export const ALLOWED_EVENT_TYPES = [
  'page_view',
  'product_view',
  'category_view',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'cart_view',
  'checkout_started',
  'checkout_step',
  'order_completed',
  'wishlist_add',
  'wishlist_remove',
  'instagram_post_published',
  'instagram_post_likes',
  'instagram_post_comments',
  'email_open',
] as const;

export type ClientEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export interface RecordEventInput {
  eventType: string;
  userId?: number | null;
  sessionId?: string | null;
  productId?: number | null;
  orderId?: number | null;
  metadata?: Record<string, unknown> | null;
}

export function isValidEventType(eventType: unknown): eventType is ClientEventType {
  return (
    typeof eventType === 'string' && (ALLOWED_EVENT_TYPES as readonly string[]).includes(eventType)
  );
}

export async function recordClientEvent(input: RecordEventInput): Promise<void> {
  if (!isValidEventType(input.eventType)) return;

  await prisma.clientEvent.create({
    data: {
      eventType: input.eventType,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      productId: input.productId ?? null,
      orderId: input.orderId ?? null,
      metadata: (input.metadata ?? null) as never,
    },
  });
}

export async function recordClientEventsBatch(events: RecordEventInput[]): Promise<number> {
  const valid = events.filter((e) => isValidEventType(e.eventType));
  if (valid.length === 0) return 0;

  const result = await prisma.clientEvent.createMany({
    data: valid.map((e) => ({
      eventType: e.eventType,
      userId: e.userId ?? null,
      sessionId: e.sessionId ?? null,
      productId: e.productId ?? null,
      orderId: e.orderId ?? null,
      metadata: (e.metadata ?? null) as never,
    })),
  });

  return result.count;
}
