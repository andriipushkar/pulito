import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { logger } from '@/lib/logger';

/**
 * Generic billing webhook for SaaS subscription payments. Accepts a payload
 * of `{ provider, invoiceId, paid, signature }`. We don't bind to a single
 * provider's exact contract — each provider's serverless function should
 * normalise its callback into this shape and POST here. Keeps the platform
 * provider-agnostic.
 *
 * Auth: HMAC-SHA256 signature over `{provider}:{invoiceId}:{paid}` using
 * APP_SECRET. Providers wrapping this should compute the same.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, invoiceId, paid, signature } = body as {
      provider?: string;
      invoiceId?: number;
      paid?: boolean;
      signature?: string;
    };

    if (!provider || !invoiceId || typeof paid !== 'boolean' || !signature) {
      return errorResponse('Expected { provider, invoiceId, paid, signature }', 400);
    }

    const secret = process.env.APP_SECRET;
    if (!secret) {
      // Fail closed in any environment: an empty/default secret means
      // signatures are forgeable and anyone can flip invoices to "paid".
      logger.error('[billing/webhook] APP_SECRET is not configured');
      return errorResponse('Сервіс не сконфігуровано (APP_SECRET)', 503);
    }
    const payload = `${provider}:${invoiceId}:${paid}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return errorResponse('Невалідний підпис', 401);
    }

    const invoice = await prisma.billingInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return errorResponse('Інвойс не знайдено', 404);

    // Atomic claim: only flip the status if it's still in the expected state.
    // Two duplicate webhook deliveries from the provider can both pass the
    // findUnique check; updateMany serialises here and one becomes a no-op.
    if (paid && invoice.status !== 'paid') {
      const claimed = await prisma.billingInvoice.updateMany({
        where: { id: invoiceId, status: { not: 'paid' } },
        data: { status: 'paid', paidAt: new Date() },
      });
      if (claimed.count > 0) {
        logger.info(`[billing/webhook] invoice ${invoiceId} marked paid by ${provider}`);
      }
    } else if (!paid && invoice.status === 'paid') {
      // Refund / reversal — flip back to overdue so finance can chase it.
      const claimed = await prisma.billingInvoice.updateMany({
        where: { id: invoiceId, status: 'paid' },
        data: { status: 'overdue', paidAt: null },
      });
      if (claimed.count > 0) {
        logger.warn(`[billing/webhook] invoice ${invoiceId} reverted (refund?) by ${provider}`);
      }
    }

    // No user context — log as system action with provider in details.
    await logAudit({
      userId: 0,
      actionType: 'data_update',
      entityType: 'billing_invoice',
      entityId: invoiceId,
      details: { provider, paid, source: 'webhook' },
    }).catch(() => {});

    return successResponse({ ok: true });
  } catch (err) {
    logger.error('[billing/webhook] failed', { error: err });
    return errorResponse('Помилка обробки webhook', 500);
  }
}
