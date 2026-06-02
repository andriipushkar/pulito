import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { sendEmail } from '@/services/email';
import { logger } from '@/lib/logger';
// Single source of truth for frequency → days. Previously duplicated in
// subscription.ts; if one diverged, next-delivery dates shown to customer
// drifted from the cron's actual fire dates.
import { FREQUENCY_DAYS } from '@/services/subscription-frequency';

const APP_URL = process.env.APP_URL || 'https://pulito.trade';

export async function processSubscriptionOrders() {
  const now = new Date();

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      nextDeliveryAt: { lte: now },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              priceRetail: true,
              quantity: true,
              isActive: true,
              imagePath: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const subscription of dueSubscriptions) {
    try {
      // Atomic claim: only proceed if nextDeliveryAt is still due. If a
      // parallel cron run (or a retry from the same scheduler) already
      // processed this subscription, count===0 and we skip — no duplicate
      // order. We push nextDeliveryAt forward by 1 minute as a "claim
      // sentinel" so a second worker reading dueSubscriptions never picks
      // this row up. The real next-delivery date gets set further down
      // after the order is created.
      const claimed = await prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          status: 'active',
          nextDeliveryAt: { lte: now },
        },
        data: { nextDeliveryAt: new Date(now.getTime() + 60_000) },
      });
      if (claimed.count === 0) {
        skipped++;
        continue;
      }

      // Build cart items from subscription items
      const cartItems = subscription.items
        .filter((item) => item.product.isActive && item.product.quantity >= item.quantity)
        .map((item) => ({
          productId: item.product.id,
          productCode: item.product.code,
          productName: item.product.name,
          price: Number(item.product.priceRetail),
          quantity: item.quantity,
          isPromo: false,
        }));

      if (cartItems.length === 0) {
        logger.warn(
          `[subscription-cron] Підписка #${subscription.id}: немає доступних товарів, пропущено`,
        );
        // We bumped nextDeliveryAt by +1 minute as a claim sentinel above. If
        // we leave it there, the next cron run will retry in a minute. For a
        // permanently-empty subscription that means logspam forever — push
        // the date to the regular next cycle so we retry once per frequency,
        // not every minute.
        const days = FREQUENCY_DAYS[subscription.frequency] ?? 30;
        const skipUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { nextDeliveryAt: skipUntil, remindAt: skipUntil },
        });
        skipped++;
        continue;
      }

      // Calculate discount (use integer math to avoid Decimal precision loss)
      const discountPercent = Number(subscription.discountPercent || 0);
      const itemsTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discountAmount = Math.round(itemsTotal * discountPercent * 100) / 10000;
      const roundedDiscount = Math.round(discountAmount * 100) / 100;

      const checkout = {
        contactName: subscription.user.fullName,
        contactPhone: subscription.user.phone || '+380000000000',
        contactEmail: subscription.user.email,
        deliveryMethod: (subscription.deliveryMethod || 'nova_poshta') as
          | 'nova_poshta'
          | 'ukrposhta'
          | 'pickup'
          | 'pallet',
        deliveryCity: subscription.deliveryCity || undefined,
        deliveryAddress: subscription.deliveryAddress || undefined,
        paymentMethod: (subscription.paymentMethod || 'bank_transfer') as
          | 'cod'
          | 'bank_transfer'
          | 'online'
          | 'card_prepay',
      };

      const order = await createOrder(subscription.userId, checkout, cartItems, 'retail');

      // Audit-trail every auto-generated subscription order so support can
      // reconcile customer disputes ("why was I charged?" → "auto-renewal
      // of subscription #N at T, see audit row"). userId 0 = system actor.
      try {
        const { logAudit } = await import('@/services/audit');
        await logAudit({
          userId: 0,
          actionType: 'data_create',
          entityType: 'subscription_auto_order',
          entityId: order.id,
          details: {
            subscriptionId: subscription.id,
            customerUserId: subscription.userId,
            frequency: subscription.frequency,
            itemsTotal,
            discount: roundedDiscount,
            source: 'cron:process-subscriptions',
          },
        });
      } catch (err) {
        logger.warn('[process-subscriptions] audit log failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Apply subscription discount. KEEP delivery in the total — createOrder
      // already added it; recomputing as (itemsTotal − discount) silently
      // dropped the shipping cost, undercharging every discounted subscription
      // order by the full delivery fee.
      const deliveryCost = Number(order.deliveryCost ?? 0);
      if (roundedDiscount > 0) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            discountAmount: roundedDiscount,
            totalAmount: Math.max(
              0,
              Math.round((itemsTotal - roundedDiscount + deliveryCost) * 100) / 100,
            ),
          },
        });
      }

      // Update subscription: next delivery and last order.
      // `remindAt` = next-delivery minus 24h so the reminder cron can send a
      // "your subscription order ships tomorrow" email; reset reminderSentAt
      // so the new cycle's reminder is allowed to fire.
      const days = FREQUENCY_DAYS[subscription.frequency] ?? 30;
      const nextDeliveryAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const remindAt = new Date(nextDeliveryAt.getTime() - 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          nextDeliveryAt,
          lastOrderId: order.id,
          remindAt,
          reminderSentAt: null,
          // Successful order means the previous payment retry state is no
          // longer relevant — reset.
          paymentRetryCount: 0,
          lastFailedPaymentAt: null,
        },
      });

      // Notify customer so they can pay manually (no auto-charge yet).
      // Wrapped in try/catch so email failure does not abort the cron loop.
      try {
        const finalTotal =
          roundedDiscount > 0
            ? Math.max(0, Math.round((itemsTotal - roundedDiscount + deliveryCost) * 100) / 100)
            : Number(order.totalAmount);
        const firstName = subscription.user.fullName?.split(' ')[0] ?? null;
        await sendEmail({
          to: subscription.user.email,
          subject: `Ваше підписне замовлення #${order.orderNumber} готове до оплати`,
          html: `
            <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
            <p>За вашою підпискою створено нове замовлення:</p>
            <ul>${cartItems.map((i) => `<li>${i.productName} — ${i.quantity} шт</li>`).join('')}</ul>
            <p>До оплати: <strong>${finalTotal.toFixed(2)} ₴</strong>${
              roundedDiscount > 0 ? ` (зі знижкою підписки –${discountPercent}%)` : ''
            }</p>
            <p><a href="${APP_URL}/account/orders" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px">Оплатити</a></p>
            <p style="color:#666;font-size:12px">Управляйте підпискою: <a href="${APP_URL}/account/subscriptions">${APP_URL}/account/subscriptions</a></p>
          `,
        });
      } catch (emailErr) {
        logger.warn(
          `[subscription-cron] Підписка #${subscription.id}: email-нотифікація не надіслана: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`,
        );
      }

      processed++;
      logger.info(
        `[subscription-cron] Підписка #${subscription.id}: створено замовлення #${order.orderNumber}`,
      );
    } catch (error) {
      failed++;
      logger.error(
        `[subscription-cron] Підписка #${subscription.id}: помилка — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { processed, failed, skipped };
}

const PAYMENT_RETRY_LIMIT = 2;
const PAYMENT_RETRY_AFTER_DAYS = 7;

/**
 * Sweep "failed" subscription payments: orders created by the subscription
 * cron that are still `paymentStatus=pending` after PAYMENT_RETRY_AFTER_DAYS.
 *
 * Behaviour:
 *   1st detection → bump `paymentRetryCount`, set `lastFailedPaymentAt`
 *     and push `nextDeliveryAt` forward by 7d so the order-creation cron
 *     will retry on the next pass.
 *   2nd detection (count >= LIMIT) → pause subscription with
 *     `pausedReason='payment_failed_auto'` and `cancelReason` unset
 *     (a paused subscription can be resumed by user/admin).
 *
 * Designed to be called from a daily cron, independent from the
 * order-creation cron that runs every 30 min.
 */
export async function processFailedSubscriptionPayments() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - PAYMENT_RETRY_AFTER_DAYS * 86_400_000);

  const candidates = await prisma.subscription.findMany({
    where: {
      status: 'active',
      lastOrderId: { not: null },
    },
    select: {
      id: true,
      lastOrderId: true,
      paymentRetryCount: true,
      frequency: true,
      nextDeliveryAt: true,
    },
  });

  let retried = 0;
  let paused = 0;

  for (const sub of candidates) {
    if (!sub.lastOrderId) continue;
    const lastOrder = await prisma.order.findUnique({
      where: { id: sub.lastOrderId },
      select: { paymentStatus: true, createdAt: true, status: true },
    });
    if (!lastOrder) continue;
    if (lastOrder.paymentStatus !== 'pending') continue;
    if (lastOrder.createdAt > cutoff) continue;
    if (lastOrder.status === 'cancelled') continue;

    const nextCount = sub.paymentRetryCount + 1;
    if (nextCount > PAYMENT_RETRY_LIMIT) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'paused',
          pausedAt: now,
          pausedReason: 'payment_failed_auto',
        },
      });
      paused++;
      logger.warn(`[subscription-payments] #${sub.id} paused after ${nextCount} failed attempts`);
    } else {
      // Bump retry count; push nextDeliveryAt to retry in PAYMENT_RETRY_AFTER_DAYS
      const retryAt = new Date(now.getTime() + PAYMENT_RETRY_AFTER_DAYS * 86_400_000);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          paymentRetryCount: nextCount,
          lastFailedPaymentAt: now,
          nextDeliveryAt: retryAt,
        },
      });
      retried++;
      logger.info(`[subscription-payments] #${sub.id} retry ${nextCount}/${PAYMENT_RETRY_LIMIT}`);
    }
  }

  return { retried, paused };
}

/**
 * Send "your subscription delivery is tomorrow" reminders. Picks subscriptions
 * where remindAt <= now and reminderSentAt is null (one-shot per cycle).
 *
 * Failure to send email does not abort — the row is still marked sent so we
 * don't spam the same person on every cron tick if their provider is down.
 */
export async function processSubscriptionReminders() {
  const now = new Date();
  const due = await prisma.subscription.findMany({
    where: {
      status: 'active',
      remindAt: { lte: now },
      reminderSentAt: null,
    },
    include: {
      user: { select: { fullName: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    take: 200, // batch cap
  });

  let sent = 0;
  for (const sub of due) {
    try {
      const firstName = sub.user.fullName?.split(' ')[0] ?? null;
      await sendEmail({
        to: sub.user.email,
        subject: 'Завтра — день вашої підписної доставки',
        html: `
          <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
          <p>Завтра автоматично сформується ваше підписне замовлення на:</p>
          <ul>${sub.items.map((i) => `<li>${i.product.name} — ${i.quantity} шт</li>`).join('')}</ul>
          <p>Якщо хочете щось змінити чи поставити паузу — встигніть до ранку:</p>
          <p><a href="${APP_URL}/account/subscriptions">${APP_URL}/account/subscriptions</a></p>
        `,
      });
      sent++;
    } catch (err) {
      logger.warn(
        `[subscription-reminder] #${sub.id} email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }
  return { sent, total: due.length };
}
