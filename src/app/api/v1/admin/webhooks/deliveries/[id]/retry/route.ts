import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { decrypt, isEncrypted } from '@/lib/encryption';

// Retry a previously-failed webhook delivery: re-fetches the original payload,
// signs it with the current subscription secret, POSTs again, and persists a
// new WebhookDelivery row (attempt = previous + 1). Lets the admin replay a
// downstream service that was briefly down without manually re-triggering
// the upstream order/payment flow.
export const POST = withRole('admin')(
  async (_request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const deliveryId = Number(id);
      if (!deliveryId || isNaN(deliveryId)) {
        return errorResponse('Невалідний ID', 400);
      }

      const original = await prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
        include: { subscription: true },
      });
      if (!original) return errorResponse('Доставку не знайдено', 404);
      if (!original.subscription.isActive) {
        return errorResponse('Підписка деактивована', 400);
      }

      const sub = original.subscription;
      const secret = isEncrypted(sub.secret) ? decrypt(sub.secret) : sub.secret;
      const body = JSON.stringify({
        event: original.event,
        payload: original.payload ?? {},
        timestamp: new Date().toISOString(),
      });
      const signature = createHmac('sha256', secret).update(body).digest('hex');

      const start = Date.now();
      let statusCode: number | null = null;
      let error: string | null = null;
      try {
        const res = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': original.event,
            'X-Webhook-Retry': 'true',
          },
          body,
          signal: AbortSignal.timeout(5_000),
        });
        statusCode = res.status;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        logger.warn('[webhook/retry] delivery failed', {
          subscriptionId: sub.id,
          error,
        });
      }

      const delivery = await prisma.webhookDelivery.create({
        data: {
          subscriptionId: sub.id,
          event: original.event,
          payload: (original.payload ?? {}) as object,
          statusCode,
          error,
          attempt: (original.attempt ?? 1) + 1,
          durationMs: Date.now() - start,
        },
      });

      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'webhook_delivery',
        entityId: deliveryId,
        details: { action: 'retry', subscriptionId: sub.id, statusCode },
      });

      return successResponse({
        delivery,
        success: statusCode != null && statusCode >= 200 && statusCode < 300,
      });
    } catch (err) {
      logger.error('[admin/webhooks/deliveries/[id]/retry] failed', { error: err });
      return errorResponse('Помилка повторної доставки', 500);
    }
  },
);
