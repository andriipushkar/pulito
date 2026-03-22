import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { logger } from '@/lib/logger';

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
};

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
        logger.warn(`[subscription-cron] Підписка #${subscription.id}: немає доступних товарів, пропущено`);
        skipped++;
        continue;
      }

      // Calculate discount
      const discountPercent = Number(subscription.discountPercent);
      const itemsTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const discountAmount = Math.round(itemsTotal * discountPercent) / 100;

      const checkout = {
        contactName: subscription.user.fullName,
        contactPhone: subscription.user.phone || '+380000000000',
        contactEmail: subscription.user.email,
        deliveryMethod: (subscription.deliveryMethod || 'nova_poshta') as 'nova_poshta' | 'ukrposhta' | 'pickup' | 'pallet',
        deliveryCity: subscription.deliveryCity || undefined,
        deliveryAddress: subscription.deliveryAddress || undefined,
        paymentMethod: (subscription.paymentMethod || 'bank_transfer') as 'cod' | 'bank_transfer' | 'online' | 'card_prepay',
      };

      const order = await createOrder(subscription.userId, checkout, cartItems, 'retail');

      // Apply subscription discount
      if (discountAmount > 0) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            discountAmount,
            totalAmount: Math.max(0, itemsTotal - discountAmount),
          },
        });
      }

      // Update subscription: next delivery and last order
      const days = FREQUENCY_DAYS[subscription.frequency] ?? 30;
      const nextDeliveryAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          nextDeliveryAt,
          lastOrderId: order.id,
        },
      });

      processed++;
      logger.info(`[subscription-cron] Підписка #${subscription.id}: створено замовлення #${order.orderNumber}`);
    } catch (error) {
      failed++;
      logger.error(`[subscription-cron] Підписка #${subscription.id}: помилка — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { processed, failed, skipped };
}
