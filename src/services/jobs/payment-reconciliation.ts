import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { handlePaymentCallback } from '@/services/payment';
import * as liqpay from '@/services/payment-providers/liqpay';
import * as monobank from '@/services/payment-providers/monobank';
import * as wayforpay from '@/services/payment-providers/wayforpay';

const STALE_AFTER_MINUTES = 30;
const MAX_AGE_DAYS = 14;

/**
 * Find online-payment orders stuck in `pending` for >30 min and reconcile their
 * status with the provider directly. Catches cases when the provider webhook
 * was lost (network blip, our service was down, etc).
 */
export async function reconcileStuckPayments(): Promise<{ checked: number; resolved: number }> {
  const since = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);
  const tooOld = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.payment.findMany({
    where: {
      paymentMethod: 'online',
      paymentStatus: 'pending',
      createdAt: { lt: since, gt: tooOld },
    },
    select: {
      orderId: true,
      paymentProvider: true,
      transactionId: true,
      amount: true,
      order: { select: { id: true, orderNumber: true } },
    },
    take: 100,
  });

  let resolved = 0;

  for (const p of candidates) {
    try {
      let providerStatus: { status: 'success' | 'failure' | 'processing'; amount?: number } | null =
        null;

      if (p.paymentProvider === 'liqpay') {
        providerStatus = await liqpay.checkPaymentStatus(p.orderId);
      } else if (p.paymentProvider === 'monobank' && p.transactionId) {
        providerStatus = await monobank.checkInvoiceStatus(p.transactionId);
      } else if (p.paymentProvider === 'wayforpay' && p.transactionId) {
        providerStatus = await wayforpay.checkTransactionStatus(p.transactionId);
      }

      if (!providerStatus || providerStatus.status === 'processing') continue;

      // Reuse the same handler that webhooks use — keeps audit + notifications consistent.
      await handlePaymentCallback(p.paymentProvider as 'liqpay' | 'monobank' | 'wayforpay', {
        orderId: p.orderId,
        status: providerStatus.status,
        transactionId: p.transactionId ?? '',
        rawData: { source: 'reconciliation' },
        amount: providerStatus.amount,
      });
      resolved++;
      logger.info('Reconciled payment', {
        orderNumber: p.order.orderNumber,
        provider: p.paymentProvider,
        status: providerStatus.status,
      });
    } catch (err) {
      logger.error('Reconciliation failed for payment', {
        orderId: p.orderId,
        error: String(err),
      });
    }
  }

  return { checked: candidates.length, resolved };
}
