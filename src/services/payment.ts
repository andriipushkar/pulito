import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { subtractMoney, addMoney, compareMoney } from '@/utils/money';
import type {
  PaymentProvider,
  PaymentInitResult,
  PaymentCallbackResult,
  RefundResult,
} from '@/types/payment';
import * as liqpay from './payment-providers/liqpay';
import * as monobank from './payment-providers/monobank';
import * as wayforpay from './payment-providers/wayforpay';
import { getLiqPayCreds, getWayForPayCreds } from './integration-credentials';

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

  // Resolve underlying provider for refund routing.
  let providerKey: PaymentProvider = provider;

  if (provider === 'liqpay') {
    const serverUrl = `${env.APP_URL}/api/webhooks/liqpay`;
    result = await liqpay.createPayment(orderId, amount, description, resultUrl, serverUrl);
  } else if (provider === 'liqpay_paypart') {
    const serverUrl = `${env.APP_URL}/api/webhooks/liqpay`;
    result = await liqpay.createPaypartPayment(orderId, amount, description, resultUrl, serverUrl);
    providerKey = 'liqpay';
  } else if (provider === 'monobank') {
    const webhookUrl = `${env.APP_URL}/api/webhooks/monobank`;
    result = await monobank.createPayment(orderId, amount, description, resultUrl, webhookUrl);
  } else if (provider === 'apple_pay' || provider === 'google_pay') {
    // Route to whichever underlying gateway is configured. WayForPay first
    // (more polished Apple/Google Pay flow), LiqPay as fallback.
    const wfp = await getWayForPayCreds();
    const lp = await getLiqPayCreds();
    if (wfp.merchantAccount && wfp.secretKey) {
      const serviceUrl = `${env.APP_URL}/api/webhooks/wayforpay`;
      result = await wayforpay.createPayment(orderId, amount, description, resultUrl, serviceUrl, {
        paymentSystems: provider === 'apple_pay' ? 'applePay' : 'googlePay',
      });
      providerKey = 'wayforpay';
    } else if (lp.publicKey && lp.privateKey) {
      const serverUrl = `${env.APP_URL}/api/webhooks/liqpay`;
      result =
        provider === 'apple_pay'
          ? await liqpay.createApplePayPayment(orderId, amount, description, resultUrl, serverUrl)
          : await liqpay.createGooglePayPayment(orderId, amount, description, resultUrl, serverUrl);
      providerKey = 'liqpay';
    } else {
      throw new PaymentError(
        provider === 'apple_pay'
          ? 'Apple Pay недоступний — потрібен налаштований WayForPay або LiqPay'
          : 'Google Pay недоступний — потрібен налаштований WayForPay або LiqPay',
        400,
      );
    }
  } else {
    const serviceUrl = `${env.APP_URL}/api/webhooks/wayforpay`;
    result = await wayforpay.createPayment(orderId, amount, description, resultUrl, serviceUrl);
  }

  // Create or update payment record
  await prisma.payment.upsert({
    where: { orderId },
    update: {
      paymentProvider: providerKey,
      transactionId: result.paymentId || null,
    },
    create: {
      orderId,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      amount,
      paymentProvider: providerKey,
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

  // Replay protection: atomic SET NX ensures only one thread processes each
  // webhook. Dedup fingerprint:
  //   - With transactionId: use it directly — the provider's own unique key.
  //   - Without transactionId: hash (orderId, status, amount, provider). Was
  //     using Date.now() which made each call "unique", silently bypassing
  //     replay protection — two webhooks 1ms apart would BOTH process.
  const dedupeKeyPart =
    transactionId && transactionId.length > 0
      ? transactionId
      : `o${orderId}:s${status}:a${paidAmount ?? 'na'}`;
  const webhookKey = `webhook:${provider}:${dedupeKeyPart}`;
  const wasSet = await redis.set(webhookKey, '1', 'EX', WEBHOOK_TTL_SECONDS, 'NX');
  if (!wasSet) {
    logger.info('Duplicate webhook ignored', { provider, transactionId, orderId });
    return; // Already processed
  }

  // Amount validation: verify paid amount matches order total. A mismatch is
  // a security signal (manipulated callback or kopecks/UAH confusion in a
  // provider response) — we both REJECT the payment AND surface it via an
  // audit-grade log so monitoring picks it up.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { totalAmount: true, orderNumber: true, userId: true, status: true },
  });

  let effectiveStatus = status;

  if (status === 'success' && paidAmount != null && order) {
    const expectedAmount = Number(order.totalAmount);
    const diff = Math.abs(paidAmount - expectedAmount);

    // Defensive sanity check: if paidAmount is ~100× expected, the provider
    // likely sent kopecks instead of hryvnias (or vice versa). Surface as a
    // distinct log signature so ops can spot a misconfigured provider quickly.
    if (
      expectedAmount > 0 &&
      Math.abs(paidAmount / expectedAmount - 100) < 1 &&
      paidAmount > expectedAmount
    ) {
      logger.error('PAYMENT_AMOUNT_LIKELY_KOPECKS_CONFUSION', {
        orderId,
        provider,
        paidAmount,
        expectedAmount,
        hint: 'paidAmount ≈ 100× expected — check if provider switched to kopecks unit',
      });
    }

    if (diff > 0.01) {
      // Audit-grade signal — payment amount mismatch is a serious anomaly,
      // not just a warning. Log with a fixed signature so monitoring can
      // alert on it.
      logger.error('PAYMENT_AMOUNT_MISMATCH', {
        orderId,
        provider,
        paidAmount,
        expectedAmount,
        diff,
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
      // Payment confirmation also advances the order lifecycle to 'paid', but
      // must never regress an order a manager already moved further
      // (shipped/completed/etc). Record the REAL oldStatus so the history isn't
      // a misleading "null → paid"; if we can't advance, log the payment
      // against the unchanged status instead of faking a transition.
      const prePaidStatuses = ['new_order', 'processing', 'confirmed'];
      const currentStatus = order?.status ?? 'new_order';
      const advanceStatus = prePaidStatuses.includes(currentStatus);
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'paid',
          ...(advanceStatus && { status: 'paid' }),
          statusHistory: {
            create: {
              oldStatus: currentStatus,
              newStatus: advanceStatus ? 'paid' : currentStatus,
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
            select: {
              productId: true,
              productCode: true,
              productName: true,
              priceAtOrder: true,
              quantity: true,
            },
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
              // Key on productCode (SKU) to match the browser pixel's content_ids.
              items: orderWithItems.items.map((i) => ({
                id: i.productCode || String(i.productId),
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
      refundedAmount: true,
      order: {
        select: { orderNumber: true, totalAmount: true, status: true },
      },
    },
  });

  if (!payment) {
    throw new PaymentError('Платіж не знайдено', 404);
  }

  if (!['paid', 'partial'].includes(payment.paymentStatus)) {
    throw new PaymentError('Повернення можливе тільки для оплачених замовлень', 400);
  }

  if (!payment.paymentProvider || !payment.transactionId) {
    throw new PaymentError('Відсутні дані провайдера для повернення', 400);
  }

  const paidAmount = Number(payment.amount);
  const alreadyRefunded = Number(payment.refundedAmount);
  const remaining = subtractMoney(paidAmount, alreadyRefunded);
  const refundAmount = amount ?? remaining;
  // Accumulated check: every refund (this + prior partials) must fit inside
  // the paid total. Defends against the case where paymentStatus was manually
  // flipped back to `paid` after a partial refund. Compared in kopecks so a
  // float tail can't let an over-refund slip through (or block an exact one).
  if (compareMoney(refundAmount, remaining) > 0) {
    throw new PaymentError(
      `Сума повернення (${refundAmount}) перевищує доступну (${remaining.toFixed(2)} = ` +
        `сплачено ${paidAmount} − вже повернуто ${alreadyRefunded})`,
      400,
    );
  }
  if (refundAmount <= 0) {
    throw new PaymentError('Сума повернення має бути додатною', 400);
  }
  const isPartial = compareMoney(addMoney(alreadyRefunded, refundAmount), paidAmount) < 0;
  const provider = payment.paymentProvider as PaymentProvider;

  // Serialise concurrent refunds for the same order. Without this, two
  // admins clicking "Refund" at the same time both pass the paid check and
  // both call the provider, double-refunding the customer. We use a
  // Postgres advisory lock keyed by orderId; auto-released when the
  // transaction ends. (Outside an explicit tx, pg_try_advisory_lock holds
  // until pg_advisory_unlock — we release in finally.)
  const REFUND_LOCK_NS = 0x52454655; // "REFU"
  const lockRows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT pg_try_advisory_lock(${REFUND_LOCK_NS}::int, ${orderId}::int) AS ok
  `;
  if (!lockRows[0]?.ok) {
    throw new PaymentError('Повернення для цього замовлення вже виконується', 409);
  }
  const releaseLock = async () => {
    try {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${REFUND_LOCK_NS}::int, ${orderId}::int)`;
    } catch {
      // ignored — connection may have already returned to pool
    }
  };

  // Re-check status after acquiring the lock — another refund may have
  // completed between the initial read and the lock acquisition.
  const fresh = await prisma.payment.findUnique({
    where: { orderId },
    select: { paymentStatus: true },
  });
  // Allow 'partial' too — sequential partial refunds on one order are a valid
  // flow. The accumulated over-refund guard above (refund ≤ paid − refunded)
  // still caps the total, and the advisory lock serialises them.
  if (!fresh || !['paid', 'partial'].includes(fresh.paymentStatus)) {
    await releaseLock();
    throw new PaymentError('Повернення вже виконано або статус змінився', 409);
  }

  let result: RefundResult;
  try {
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
      // Lifecycle status doesn't change on a refund — we only flip paymentStatus.
      // The status-history row must use real OrderStatus values on both sides,
      // otherwise the "Історія" panel renders `undefined → undefined` because
      // ORDER_STATUS_LABELS has no `'partial'`/`'refunded'` keys.
      const currentLifecycleStatus = payment.order.status;

      await prisma.$transaction([
        prisma.payment.update({
          where: { orderId },
          data: {
            paymentStatus: newPaymentStatus,
            refundedAmount: { increment: refundAmount },
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: newPaymentStatus,
            statusHistory: {
              create: {
                oldStatus: currentLifecycleStatus,
                newStatus: currentLifecycleStatus,
                changeSource: 'system',
                comment: isPartial
                  ? `Часткове повернення ${refundAmount} грн через ${provider} (оплата: paid → partial)`
                  : `Повне повернення ${refundAmount} грн через ${provider} (оплата: paid → refunded)`,
              },
            },
          },
        }),
      ]);

      // Reverse loyalty points pro-rata for the refunded amount. If the
      // order earned 100 points on a 1000 UAH payment and we refund 250,
      // claw back 25 points. Without this the customer keeps full points
      // on a partial-refunded order.
      try {
        const earn = await prisma.loyaltyTransaction.findFirst({
          where: { orderId, type: 'earn' },
          select: { points: true, userId: true },
        });
        if (earn && earn.points > 0 && paidAmount > 0) {
          const refundRatio = Math.min(1, refundAmount / paidAmount);
          const pointsToClaw = Math.floor(earn.points * refundRatio);
          if (pointsToClaw > 0) {
            const { adjustPoints } = await import('@/services/loyalty');
            await adjustPoints({
              userId: earn.userId,
              type: 'manual_deduct',
              points: pointsToClaw,
              description: `Сторнування балів за повернення замовлення #${orderId} (${refundAmount} грн)`,
            }).catch((err) => {
              logger.warn('[refund] loyalty clawback failed (non-fatal)', {
                orderId,
                pointsToClaw,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        }
      } catch (err) {
        logger.warn('[refund] loyalty clawback lookup failed', {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info('Refund processed', {
        orderId,
        provider,
        amount: refundAmount,
        isPartial,
        refundId: result.refundId,
      });
    }
  } finally {
    await releaseLock();
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
