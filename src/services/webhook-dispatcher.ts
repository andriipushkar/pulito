import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { decrypt, isEncrypted } from '@/lib/encryption';

/**
 * Fire-and-forget delivery: any subscriber whose `events` list includes
 * `event` gets pinged. We POST JSON with a hex SHA-256 HMAC of the body in
 * the X-Webhook-Signature header so receivers can verify authenticity.
 *
 * Errors are swallowed — failed deliveries are recorded in webhook_deliveries
 * but never block the caller (which is usually an order/payment handler).
 */
export async function dispatchWebhook(
  event: 'order.created' | 'order.status_changed' | 'payment.received' | 'stock.low',
  payload: Record<string, unknown>,
): Promise<void> {
  const subs = await prisma.webhookSubscription.findMany({
    where: { isActive: true, events: { has: event } },
  });

  await Promise.all(
    subs.map(async (sub) => {
      const start = Date.now();
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      // Decrypt secret at the moment of signing — legacy plaintext rows still
      // pass through (isEncrypted returns false for them).
      const secret = isEncrypted(sub.secret) ? decrypt(sub.secret) : sub.secret;
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      let statusCode: number | null = null;
      let error: string | null = null;
      try {
        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
          },
          body,
          signal: AbortSignal.timeout(5_000),
        });
        statusCode = res.status;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        logger.warn('Webhook delivery failed', { subscriptionId: sub.id, error });
      }
      const durationMs = Date.now() - start;
      await prisma.webhookDelivery.create({
        data: {
          subscriptionId: sub.id,
          event,
          payload: payload as object,
          statusCode,
          error,
          durationMs,
        },
      });
    }),
  );
}
