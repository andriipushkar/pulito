import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import type {
  PaymentProvider,
  PaymentInitResult,
  PaymentCallbackResult,
  RefundResult,
} from '@/types/payment';
import * as liqpay from './payment-providers/liqpay';
import * as monobank from './payment-providers/monobank';
import * as wayforpay from './payment-providers/wayforpay';

const WEBHOOK_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export class PaymentError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export async function initiatePayment(
  orderId: number,
  provider: PaymentProvider,
): Promise<PaymentInitResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      paymentMethod: true,
      paymentStatus: true,
      payment: true,
    },
  });

  if (!order) {
    throw new PaymentError('Замовлення не знайдено', 404);
  }

  if (order.paymentMethod !== 'online') {
    throw new PaymentError('Це замовлення не потребує онлайн-оплати', 400);
  }

  if (order.paymentStatus === 'paid') {
    throw new PaymentError('Замовлення вже оплачено', 400);
  }

  const amount = Number(order.totalAmount);
  const description = `Замовлення #${order.orderNumber}`;
  const resultUrl = `${env.APP_URL}/checkout/payment-redirect?orderId=${orderId}`;

  let result: PaymentInitResult;

  if (provider === 'liqpay') {
    const serverUrl = `${env.APP_URL}/api/webhooks/liqpay`;
    result = await liqpay.createPayment(orderId, amount, description, resultUrl, serverUrl);
  } else if (provider === 'monobank') {
    const webhookUrl = `${env.APP_URL}/api/webhooks/monobank`;
    result = await monobank.createPayment(orderId, amount, description, resultUrl, webhookUrl);
  } else {
    const serviceUrl = `${env.APP_URL}/api/webhooks/wayforpay`;
    result = await wayforpay.createPayment(orderId, amount, description, resultUrl, serviceUrl);
  }

  // Create or update payment record
  await prisma.payment.upsert({
    where: { orderId },
    update: {
      paymentProvider: provider,
      transactionId: result.paymentId || null,
    },
    create: {
      orderId,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      amount,
      paymentProvider: provider,
      transactionId: result.paymentId || null,
    },
  });

  return result;
}

export async function handlePaymentCallback(
  provider: PaymentProvider,
  callbackResult: PaymentCallbackResult,
): Promise<void> {
  const {
    orderId,
    status,
    transactionId,
    rawData,
    receiptUrl,
    amount: paidAmount,
  } = callbackResult;

  // Replay protection: atomic SET NX ensures only one thread processes each webhook
  const webhookKey = `webhook:${provider}:${transactionId}`;
  const wasSet = await redis.set(webhookKey, '1', 'EX', WEBHOOK_TTL_SECONDS, 'NX');
  if (!wasSet) {
    logger.info('Duplicate webhook ignored', { provider, transactionId, orderId });
    return; // Already processed
  }

  // Amount validation: verify paid amount matches order total
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { totalAmount: true, orderNumber: true, userId: true },
  });

  let effectiveStatus = status;

  if (status === 'success' && paidAmount != null && order) {
    const expectedAmount = Number(order.totalAmount);
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      logger.warn('Payment amount mismatch', {
        orderId,
        provider,
        paidAmount,
        expectedAmount,
      });
      effectiveStatus = 'failure';
    }
  }

  const payment = await prisma.payment.findUnique({
    where: { orderId },
  });

  // Prevent payment status downgrade: if already paid, ignore subsequent callbacks
  if (payment && payment.paymentStatus === 'paid') {
    logger.info('Order already paid, ignoring callback', { orderId, provider });
    return;
  }

  // Resolve the actual order amount for cases where payment record doesn't exist yet
  const resolveAmount = (): number => {
    return order ? Number(order.totalAmount) : 0;
  };

  const mapStatus = (s: string): 'paid' | 'pending' => {
    if (s === 'success') return 'paid';
    // 'failure' and 'processing' both stay as 'pending' —
    // we don't mark as failed because the provider may retry or the user may retry payment
    return 'pending';
  };

  // Wrap payment + order updates in a transaction for data consistency
  await prisma.$transaction(async (tx) => {
    if (!payment) {
      const amount = resolveAmount();
      await tx.payment.create({
        data: {
          orderId,
          paymentMethod: 'online',
          paymentStatus: mapStatus(effectiveStatus),
          amount,
          paymentProvider: provider,
          transactionId,
          callbackData: rawData as unknown as Prisma.InputJsonValue,
          paidAt: effectiveStatus === 'success' ? new Date() : null,
          receiptUrl: receiptUrl || null,
        },
      });
    } else {
      await tx.payment.update({
        where: { orderId },
        data: {
          paymentStatus: mapStatus(effectiveStatus),
          transactionId,
          callbackData: rawData as unknown as Prisma.InputJsonValue,
          paidAt: effectiveStatus === 'success' ? new Date() : payment.paidAt,
          receiptUrl: receiptUrl || payment.receiptUrl,
        },
      });
    }

    // Update order payment status
    if (effectiveStatus === 'success') {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'paid',
          statusHistory: {
            create: {
              oldStatus: null,
              newStatus: 'paid',
              changeSource: 'system',
              comment: `Оплата підтверджена через ${provider}`,
            },
          },
        },
      });
    }
  });

  // Server-side conversion tracking on confirmed payment (non-blocking, outside transaction).
  if (effectiveStatus === 'success') {
    if (order) {
      const orderWithItems = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          orderNumber: true,
          totalAmount: true,
          userId: true,
          contactEmail: true,
          contactPhone: true,
          items: {
            select: { productId: true, productName: true, priceAtOrder: true, quantity: true },
          },
        },
      });

      if (orderWithItems) {
        import('@/services/server-tracking')
          .then((tracking) =>
            tracking.trackPurchase({
              userId: orderWithItems.userId ?? undefined,
              email: orderWithItems.contactEmail,
              phone: orderWithItems.contactPhone,
              orderId: orderWithItems.orderNumber,
              totalAmount: Number(orderWithItems.totalAmount),
              items: orderWithItems.items.map((i) => ({
                id: String(i.productId),
                name: i.productName,
                price: Number(i.priceAtOrder),
                quantity: i.quantity,
              })),
            }),
          )
          .catch(() => {});
      }
    }

    logger.info('Payment confirmed', { orderId, provider, transactionId });
  }
}

export async function refundPayment(orderId: number, amount?: number): Promise<RefundResult> {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      paymentStatus: true,
      paymentProvider: true,
      transactionId: true,
      amount: true,
      order: {
        select: { orderNumber: true, totalAmount: true },
      },
    },
  });

  if (!payment) {
    throw new PaymentError('Платіж не знайдено', 404);
  }

  if (payment.paymentStatus !== 'paid') {
    throw new PaymentError('Повернення можливе тільки для оплачених замовлень', 400);
  }

  if (!payment.paymentProvider || !payment.transactionId) {
    throw new PaymentError('Відсутні дані провайдера для повернення', 400);
  }

  const refundAmount = amount ?? Number(payment.amount);
  const isPartial = refundAmount < Number(payment.amount);
  const provider = payment.paymentProvider as PaymentProvider;

  let result: RefundResult;

  if (provider === 'liqpay') {
    result = await liqpay.refundPayment(orderId, refundAmount);
  } else if (provider === 'monobank') {
    result = await monobank.refundPayment(payment.transactionId, refundAmount);
  } else {
    result = await wayforpay.refundPayment(
      payment.transactionId,
      refundAmount,
      payment.transactionId,
    );
  }

  if (result.success) {
    const newPaymentStatus = isPartial ? 'partial' : 'refunded';

    await prisma.$transaction([
      prisma.payment.update({
        where: { orderId },
        data: { paymentStatus: newPaymentStatus },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: newPaymentStatus,
          statusHistory: {
            create: {
              oldStatus: 'paid',
              newStatus: newPaymentStatus,
              changeSource: 'system',
              comment: isPartial
                ? `Часткове повернення ${refundAmount} грн через ${provider}`
                : `Повне повернення ${refundAmount} грн через ${provider}`,
            },
          },
        },
      }),
    ]);

    logger.info('Refund processed', {
      orderId,
      provider,
      amount: refundAmount,
      isPartial,
      refundId: result.refundId,
    });
  }

  return result;
}

export async function getPaymentStatus(orderId: number) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: {
      paymentStatus: true,
      paymentProvider: true,
      transactionId: true,
      amount: true,
      paidAt: true,
    },
  });

  return payment;
}
