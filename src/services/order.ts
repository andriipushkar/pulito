import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { randomBytes } from 'crypto';
import type { CheckoutInput, OrderFilterInput } from '@/validators/order';
import { logger } from '@/lib/logger';
import { phoneSearchVariants } from '@/utils/phone';
import { env } from '@/config/env';
import { sumMoney, lineTotal, addMoney, subtractMoney, percentOf } from '@/utils/money';
import { kyivMidnightUtc, todayKyiv } from '@/utils/format';

const STATS_CACHE_KEY = 'admin:order-stats:v1';
const STATS_CACHE_TTL = 15; // seconds — collapses concurrent admin tabs onto one query.
import { calculateDeliveryCost, type DeliveryMethod } from '@/services/delivery-cost';
import { detectBundleDiscounts } from '@/services/bundle';

export class OrderError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

// Status transition matrix.
// `packed` sits between paid/confirmed and shipped so the audit trail shows
// who pulled the items off the shelf (the pack workflow updates to `packed`
// when the operator finishes scanning; the courier hand-off then moves to
// `shipped`). Direct paid → shipped is still allowed for legacy bulk
// operations that don't go through the Pick & Pack screen.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new_order: ['processing', 'cancelled'],
  processing: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'packed', 'shipped', 'cancelled'],
  paid: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['completed', 'returned'],
  completed: ['returned'],
  cancelled: [],
  returned: [],
};

// Client can only cancel in these statuses
const CLIENT_CANCELLABLE = ['new_order', 'processing'];

function generateOrderNumber(): string {
  const date = new Date();
  const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

// We track `reserved` on WarehouseStock to answer "how much of this is
// promised to open orders" — useful when warehouse staff plan replenishment.
// Pick the warehouse holding the most units for this product (the de-facto
// "main" warehouse) so split-warehouse stock doesn't double-count.
async function adjustReserved(
  tx: Prisma.TransactionClient,
  items: Array<{ productId: number | null; quantity: number }>,
  direction: 1 | -1,
) {
  for (const item of items) {
    if (!item.productId) continue;
    const target = await tx.warehouseStock.findFirst({
      where: { productId: item.productId },
      orderBy: { quantity: 'desc' },
      select: { id: true, reserved: true },
    });
    if (!target) continue;
    const next = Math.max(0, target.reserved + direction * item.quantity);
    await tx.warehouseStock.update({
      where: { id: target.id },
      data: { reserved: next },
    });
  }
}

const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  clientType: true,
  totalAmount: true,
  itemsCount: true,
  contactName: true,
  contactPhone: true,
  paymentMethod: true,
  paymentStatus: true,
  deliveryMethod: true,
  trackingNumber: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderListSelect,
  userId: true,
  assignedManagerId: true,
  discountAmount: true,
  deliveryCost: true,
  contactEmail: true,
  deliveryCity: true,
  deliveryAddress: true,
  deliveryWarehouseRef: true,
  deliveryStreetRef: true,
  deliveryBuilding: true,
  deliveryFlat: true,
  palletWeightKg: true,
  palletRegion: true,
  trackingStatus: true,
  trackingStatusAt: true,
  companyName: true,
  edrpou: true,
  comment: true,
  managerComment: true,
  source: true,
  payment: {
    select: {
      receiptUrl: true,
      paymentProvider: true,
      transactionId: true,
      paidAt: true,
    },
  },
  user: { select: { id: true, fullName: true, email: true, role: true, wholesaleGroup: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productCode: true,
      productName: true,
      priceAtOrder: true,
      quantity: true,
      subtotal: true,
      isPromo: true,
      product: {
        select: {
          imagePath: true,
          barcode: true,
          cost: true, // needed by /admin/orders/[id] margin display
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      },
    },
  },
  statusHistory: {
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      changeSource: true,
      comment: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.OrderSelect;

/**
 * @description Створює замовлення з товарів кошика, валідує гуртові правила та зменшує залишки на складі.
 * @param userId - Ідентифікатор користувача (null для гостя)
 * @param checkout - Дані оформлення замовлення (контакти, доставка, оплата)
 * @param cartItems - Масив товарів для замовлення
 * @param clientType - Тип клієнта ('retail' або 'wholesale')
 * @returns Створене замовлення з деталями
 */
export async function createOrder(
  userId: number | null,
  checkout: CheckoutInput,
  cartItems: {
    productId: number;
    productCode: string;
    productName: string;
    price: number;
    quantity: number;
    isPromo: boolean;
  }[],
  clientType: 'retail' | 'wholesale',
  // Discount taken from loyalty points balance. We treat each point as 1 UAH
  // and clamp to the items+delivery total inside this function — the caller
  // (validated against the user's balance in the API route) just passes the
  // raw amount they want to apply.
  loyaltyPointsToSpend: number = 0,
) {
  if (cartItems.length === 0) {
    throw new OrderError('Кошик порожній', 400);
  }

  // Validate wholesale rules
  if (clientType === 'wholesale') {
    // Only rules whose scheduling window currently covers now() apply
    // (NULL bound = open-ended on that side).
    const now = new Date();
    const activeWindow = {
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    };
    const rules = await prisma.wholesaleRule.findMany({
      where: { isActive: true, productId: null, ruleType: 'min_order_amount', ...activeWindow },
    });

    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    for (const rule of rules) {
      if (totalAmount < Number(rule.value)) {
        throw new OrderError(
          `Мінімальна сума замовлення: ${Number(rule.value).toFixed(2)} ₴. Ваша сума: ${totalAmount.toFixed(2)} ₴`,
          400,
        );
      }
    }

    // Per-product rules
    for (const item of cartItems) {
      const productRules = await prisma.wholesaleRule.findMany({
        where: { isActive: true, productId: item.productId, ...activeWindow },
      });

      for (const rule of productRules) {
        if (rule.ruleType === 'min_quantity' && item.quantity < Number(rule.value)) {
          throw new OrderError(
            `Мінімальна кількість для "${item.productName}": ${Number(rule.value)} шт.`,
            400,
          );
        }
        if (rule.ruleType === 'multiplicity' && item.quantity % Number(rule.value) !== 0) {
          throw new OrderError(
            `"${item.productName}" замовляється кратно ${Number(rule.value)} шт.`,
            400,
          );
        }
      }
    }
  }

  // Round to kopecks so float drift doesn't accumulate into the total for
  // high-value / many-line orders (matches editOrderItems). An unrounded total
  // can land >0.01 off the provider amount and trip the payment-mismatch guard.
  const itemsTotal = sumMoney(cartItems.map((item) => lineTotal(item.price, item.quantity)));

  // Bundle auto-discount: server-side detection of complete bundle sets in the
  // cart (the storefront bundle price is otherwise display-only — items land in
  // the cart at their normal prices). Detected here, not trusted from the
  // client. Applied to the goods subtotal BEFORE the coupon, so a percent
  // coupon computes from the already-discounted goods total.
  let bundleDiscount = 0;
  let bundleNote: string | null = null;
  const detected = await detectBundleDiscounts(
    cartItems.map((i) => ({ productId: i.productId, price: i.price, quantity: i.quantity })),
  );
  if (detected.totalDiscount > 0) {
    bundleDiscount = Math.min(detected.totalDiscount, itemsTotal);
    // Trace for the admin: like the coupon, the bundle discount has no own
    // column — totalAmount is just lower. Without this note the order total
    // looks inexplicably short of sum(items).
    bundleNote = detected.applied
      .map(
        (a) =>
          `Комплект «${a.name}»${a.sets > 1 ? ` ×${a.sets}` : ''}: знижка ${a.discount.toFixed(2)} ₴`,
      )
      .join('; ');
  }
  const goodsTotal = subtractMoney(itemsTotal, bundleDiscount);
  // Pallet method: the storefront has already done the regional-tariff
  // calculation in PalletDeliveryForm and submitted the result with the
  // checkout. Trust that value here (it's the same formula
  // calculatePalletDeliveryCost would compute) so the customer sees the same
  // total at the order-confirmation step.
  const palletCheckout = checkout as CheckoutInput & {
    palletDeliveryCost?: number;
    palletWeightKg?: number;
    palletRegion?: string;
  };
  let deliveryCost: number;
  if (checkout.deliveryMethod === 'pallet') {
    // Recompute pallet shipping SERVER-SIDE from weight/region — never trust
    // the client-submitted palletDeliveryCost (a crafted request could send 0
    // and make the shop eat the freight on a heavy pallet).
    if (palletCheckout.palletWeightKg == null) {
      throw new OrderError('Не вказано вагу для палетної доставки', 400);
    }
    try {
      const { calculatePalletDeliveryCost } = await import('@/services/pallet-delivery');
      const pallet = await calculatePalletDeliveryCost(
        palletCheckout.palletWeightKg,
        palletCheckout.palletRegion,
      );
      deliveryCost = pallet.cost;
    } catch (e) {
      throw new OrderError(
        e instanceof Error ? e.message : 'Помилка розрахунку палетної доставки',
        400,
      );
    }
  } else {
    deliveryCost = await calculateDeliveryCost(
      checkout.deliveryMethod as DeliveryMethod,
      itemsTotal,
    );
  }
  // Clamp loyalty discount so an out-of-range value can't drive totalAmount
  // negative (which would make the courier refund money to the customer).
  // Also cap by SiteSetting loyalty_max_redemption_percent so customers can't
  // pay 100% with points (typical cap: 50%). 0 in setting disables the cap.
  // Coupon (promo code) — order-level discount on the goods subtotal. Validated
  // against the goods total + product set (min-order, usage limits, expiry,
  // category/product scope all checked in validateCoupon). Applied before
  // delivery and before loyalty; stacks with loyalty and the clamps below keep
  // the total ≥ 0. Discount is clamped to itemsTotal so goods can't go negative.
  let couponDiscount = 0;
  let couponId: number | null = null;
  const couponCode = (checkout as CheckoutInput & { couponCode?: string }).couponCode?.trim();
  if (couponCode) {
    const { validateCoupon, calculateDiscount, CouponError } = await import('@/services/coupon');
    try {
      const coupon = await validateCoupon(
        couponCode,
        userId ?? undefined,
        goodsTotal,
        cartItems.map((i) => i.productId),
      );
      couponId = coupon.id;
      couponDiscount = Math.min(calculateDiscount(coupon, goodsTotal), goodsTotal);
    } catch (e) {
      throw new OrderError(e instanceof CouponError ? e.message : 'Невалідний промокод', 400);
    }
  }

  const grossTotal = addMoney(subtractMoney(goodsTotal, couponDiscount), deliveryCost);
  const settingsMod = await import('@/services/settings');
  const _settings = await settingsMod.getSettings();
  const maxPercent = Math.max(
    0,
    Math.min(100, Number(_settings.loyalty_max_redemption_percent) || 0),
  );
  const percentCap = maxPercent > 0 ? Math.floor(percentOf(grossTotal, maxPercent)) : grossTotal;
  // Floor to a whole number: 1 point = 1 UAH and the points balance is an
  // integer column, so the discount (and thus points spent) must be integer —
  // a fractional discount would write a fractional value into the Int points
  // ledger (drift / error).
  const discountAmount = Math.floor(
    Math.max(0, Math.min(Number(loyaltyPointsToSpend) || 0, grossTotal, percentCap)),
  );
  const netTotal = subtractMoney(grossTotal, discountAmount);
  const orderNumber = generateOrderNumber();

  // Per-product snapshot captured inside the transaction but read afterwards
  // (dropship notification). Holds the barcode + supplier link + purchase cost
  // at sale time so reconciliation stays correct if the product later changes.
  const productMeta = new Map<
    number,
    {
      barcode: string | null;
      supplierId: number | null;
      supplierSku: string | null;
      cost: Prisma.Decimal | null;
    }
  >();

  const order = await prisma.$transaction(async (tx) => {
    // Backorder ("під замовлення") products may be ordered past their on-hand
    // stock — the supplier fulfils them — so they skip the availability guard.
    const backorderIds = new Set(
      (
        await tx.product.findMany({
          where: { id: { in: cartItems.map((i) => i.productId) }, allowBackorder: true },
          select: { id: true },
        })
      ).map((p) => p.id),
    );

    // Verify stock availability and decrement quantities
    for (const item of cartItems) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        if (backorderIds.has(item.productId)) {
          // Decrement anyway (stock may go negative); the next supplier sync
          // overwrites it with the supplier's authoritative count.
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
        } else {
          throw new OrderError(
            `Товар "${item.productName}" недоступний у потрібній кількості`,
            400,
          );
        }
      }
    }

    // Reflect the in-flight units on WarehouseStock.reserved. Released later
    // when the order ships, is cancelled or is returned.
    await adjustReserved(
      tx,
      cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      1,
    );

    // Snapshot barcode + supplier link + cost alongside productCode/productName
    // so a later rename / barcode change / supplier reassignment doesn't rewrite
    // history. One bulk query instead of N + 1.
    const ids = cartItems.map((i) => i.productId);
    if (ids.length > 0) {
      const rows = await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, barcode: true, supplierId: true, supplierSku: true, cost: true },
      });
      for (const row of rows) {
        productMeta.set(row.id, {
          barcode: row.barcode,
          supplierId: row.supplierId,
          supplierSku: row.supplierSku,
          cost: row.cost,
        });
      }
    }

    // Create the order
    return tx.order.create({
      data: {
        orderNumber,
        userId,
        status: 'new_order',
        clientType,
        totalAmount: netTotal,
        discountAmount,
        deliveryCost,
        itemsCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
        contactName: checkout.contactName,
        contactPhone: checkout.contactPhone,
        contactEmail: checkout.contactEmail,
        companyName: checkout.companyName,
        edrpou: checkout.edrpou,
        deliveryMethod: checkout.deliveryMethod,
        deliveryCity: checkout.deliveryCity,
        deliveryWarehouseRef: checkout.deliveryWarehouseRef,
        deliveryAddress: checkout.deliveryAddress,
        deliveryStreetRef: checkout.deliveryStreetRef,
        deliveryBuilding: checkout.deliveryBuilding,
        deliveryFlat: checkout.deliveryFlat,
        // Pallet-specific snapshot — saved only when the customer picked
        // pallet delivery. Other methods leave these NULL.
        ...(checkout.deliveryMethod === 'pallet'
          ? {
              palletWeightKg: palletCheckout.palletWeightKg ?? null,
              palletRegion: palletCheckout.palletRegion ?? null,
            }
          : {}),
        paymentMethod: checkout.paymentMethod,
        paymentStatus: 'pending',
        comment: checkout.comment,
        ...(bundleNote ? { managerComment: bundleNote } : {}),
        source: 'web',
        utmSource: checkout.utmSource ?? null,
        utmMedium: checkout.utmMedium ?? null,
        utmCampaign: checkout.utmCampaign ?? null,
        items: {
          create: cartItems.map((item) => {
            const meta = productMeta.get(item.productId);
            return {
              productId: item.productId,
              productCode: item.productCode,
              productBarcode: meta?.barcode ?? null,
              productName: item.productName,
              priceAtOrder: item.price,
              quantity: item.quantity,
              subtotal: lineTotal(item.price, item.quantity),
              isPromo: item.isPromo,
              // Reconciliation snapshot: which supplier owns this line and what
              // it cost us at sale time (null for the shop's own goods).
              supplierId: meta?.supplierId ?? null,
              supplierCostAtSale: meta?.cost ?? null,
            };
          }),
        },
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: 'new_order',
            changeSource: 'system',
            comment: 'Замовлення створено',
          },
        },
      },
      select: orderDetailSelect,
    });
  });

  // Redeem the coupon now that the order exists. redeemCoupon atomically claims
  // a usage slot; if it was exhausted between validation and here (race), cancel
  // the order so we never ship a discount we couldn't account for.
  if (couponId && couponDiscount > 0) {
    try {
      const { redeemCoupon } = await import('@/services/coupon');
      await redeemCoupon(couponId, userId, order.id, couponDiscount);
    } catch (e) {
      await updateOrderStatus(
        order.id,
        'cancelled',
        null,
        'system',
        'Скасовано: промокод вичерпано',
      ).catch(() => {});
      throw new OrderError(
        e instanceof Error ? e.message : 'Промокод вичерпано, спробуйте ще раз',
        400,
      );
    }
  }

  // Clear server cart for authenticated users (non-critical — outside transaction)
  if (userId) {
    prisma.cartItem.deleteMany({ where: { userId } }).catch((err) => {
      logger.error('Cart clear after checkout failed', { userId, error: String(err) });
    });
  }

  // Notify manager about new order via Telegram (non-blocking)
  import('@/services/telegram')
    .then((mod) => mod.notifyManagerNewOrder(order))
    .catch((err) => {
      logger.error('Manager new-order notification failed', {
        orderNumber: order.orderNumber,
        error: String(err),
      });
    });

  // Notify dropship suppliers to ship their lines directly. For cash-on-delivery
  // we tell them now; for prepaid (online/card/transfer) we must NOT — a supplier
  // could ship an unpaid order — so that fires later, on payment confirmation
  // (handlePaymentCallback / updateOrderStatus → paid). The notifier is
  // idempotent on Order.dropshipNotifiedAt, so the two triggers never double-send.
  if (checkout.paymentMethod === 'cod') {
    import('@/services/suppliers/dropship-notify')
      .then((mod) => mod.notifyDropshipForOrder(order.id))
      .catch((err) => {
        logger.error('Dropship supplier notification failed', {
          orderNumber: order.orderNumber,
          error: String(err),
        });
      });
  }

  // Email fallback to the manager — Telegram is primary but may be unset in
  // prod (then the owner would never learn of a new order). Recipient is the
  // explicit MANAGER_NOTIFICATION_EMAIL, else the shop's own SMTP_FROM address
  // (skip the noreply@localhost default). Fire-and-forget; never blocks.
  const managerEmail =
    env.MANAGER_NOTIFICATION_EMAIL ||
    (env.SMTP_FROM && env.SMTP_FROM !== 'noreply@localhost' ? env.SMTP_FROM : '');
  if (managerEmail) {
    import('@/services/email-template')
      .then((mod) =>
        mod.sendNewOrderToManager({
          to: managerEmail,
          orderNumber: order.orderNumber,
          customerName: order.contactName,
          customerPhone: order.contactPhone,
          customerType: clientType === 'wholesale' ? 'wholesaler' : 'client',
          total: Number(order.totalAmount),
          itemCount: order.itemsCount,
          orderId: order.id,
        }),
      )
      .catch((err) => {
        logger.error('Manager new-order email failed', {
          orderNumber: order.orderNumber,
          error: String(err),
        });
      });
  }

  // Customer confirmation email (non-blocking). Guests rely on this for the
  // order number — they have no /account/orders to fall back to.
  if (order.contactEmail) {
    import('@/services/email')
      .then((mod) =>
        mod.sendOrderConfirmationEmail({
          to: order.contactEmail!,
          contactName: order.contactName,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
          itemsCount: order.itemsCount,
          deliveryMethod: order.deliveryMethod,
          paymentMethod: order.paymentMethod,
        }),
      )
      .catch((err) => {
        logger.error('Order confirmation email failed', {
          orderNumber: order.orderNumber,
          error: String(err),
        });
      });
  }

  // Push updated stock to marketplaces so OLX/Rozetka/Prom/Epicentr listings
  // can't oversell what we just decremented. Fire-and-forget.
  import('@/services/marketplace-sync')
    .then((mod) => mod.syncProductsStockToMarketplaces(cartItems.map((i) => i.productId)))
    .catch((err) => {
      logger.error('Marketplace stock sync after order failed', {
        orderNumber: order.orderNumber,
        error: String(err),
      });
    });

  // Bust the admin stats cache so the new-order badge shows up on the next
  // poll instead of waiting for the 15s TTL.
  invalidateOrderStatsCache();

  // Fire-and-forget Telegram notification to the owner.
  import('@/services/owner-notifications')
    .then((mod) =>
      mod.notifyOwnerNewOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        itemCount: cartItems.reduce((s, i) => s + i.quantity, 0),
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        deliveryMethod: order.deliveryMethod ?? '',
        deliveryCity: order.deliveryCity ?? null,
      }),
    )
    .catch((err) => {
      logger.warn('Owner Telegram notify failed', {
        orderNumber: order.orderNumber,
        error: String(err),
      });
    });

  // Campaign conversion attribution: if this user clicked an email link in
  // the last 7 days and that CampaignLog isn't already converted, stamp it.
  // Fire-and-forget — never delay the order response.
  if (userId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    prisma.campaignLog
      .findFirst({
        where: {
          userId,
          clickedAt: { gte: sevenDaysAgo },
          convertedAt: null,
        },
        orderBy: { clickedAt: 'desc' },
        select: { id: true },
      })
      .then((log) => {
        if (!log) return;
        return prisma.campaignLog.update({
          where: { id: log.id },
          data: { convertedAt: new Date(), conversionOrderId: order.id },
        });
      })
      .catch((err) => {
        logger.warn('Campaign conversion attribution failed', { error: String(err) });
      });
  }

  return order;
}

/**
 * @description Отримує список замовлень користувача з пагінацією та фільтрами.
 * @param userId - Ідентифікатор користувача
 * @param filters - Фільтри (статус, дати, пагінація)
 * @returns Об'єкт зі списком замовлень та загальною кількістю
 */
export async function getUserOrders(userId: number, filters: OrderFilterInput) {
  const where: Prisma.OrderWhereInput = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.dateFrom) {
    // "YYYY-MM-DD" is a Kyiv calendar day; anchor the lower bound to Kyiv 00:00
    // (DST-aware) so the shop's local day is what's filtered, not the UTC day.
    where.createdAt = { ...(where.createdAt as object), gte: kyivMidnightUtc(filters.dateFrom) };
  }
  if (filters.dateTo) {
    // Include all of the Kyiv day: lower bound is Kyiv 00:00 of the *next* day,
    // matched with `lt` so "до 14 травня" includes every order on May 14.
    const nextDay = new Date(`${filters.dateTo}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    where.createdAt = {
      ...(where.createdAt as object),
      lt: kyivMidnightUtc(nextDay.toISOString().slice(0, 10)),
    };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: orderListSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

/**
 * @description Отримує замовлення за ID з перевіркою належності користувачу.
 * @param orderId - Ідентифікатор замовлення
 * @param userId - Ідентифікатор користувача для перевірки доступу (опціонально)
 * @returns Замовлення з деталями або null
 */
export async function getOrderById(orderId: number, userId?: number) {
  const where: Prisma.OrderWhereUniqueInput = { id: orderId };

  const order = await prisma.order.findUnique({
    where,
    select: { ...orderDetailSelect, userId: true },
  });

  if (!order) return null;

  // Check ownership for non-admin requests
  if (userId !== undefined && order.userId !== userId) {
    return null;
  }

  return order;
}

/**
 * @description Отримує замовлення за його номером.
 * @param orderNumber - Номер замовлення
 * @returns Замовлення з деталями або null
 */
export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    select: orderDetailSelect,
  });
}

/**
 * @description Оновлює статус замовлення з валідацією допустимих переходів. Відновлює залишки при скасуванні/поверненні.
 * @param orderId - Ідентифікатор замовлення
 * @param newStatus - Новий статус
 * @param changedBy - ID користувача, який змінив статус (null для системи)
 * @param changeSource - Джерело зміни ('manager', 'client_action', 'system', 'cron')
 * @param comment - Коментар до зміни (опціонально)
 * @returns Оновлене замовлення з деталями
 */
export async function updateOrderStatus(
  orderId: number,
  newStatus: string,
  changedBy: number | null,
  changeSource: 'manager' | 'client_action' | 'system' | 'cron',
  comment?: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      userId: true,
      paymentMethod: true,
      paymentStatus: true,
      totalAmount: true,
      items: { select: { productId: true, quantity: true } },
    },
  });

  if (!order) {
    throw new OrderError('Замовлення не знайдено', 404);
  }

  const currentStatus = order.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new OrderError(`Неможливо змінити статус з "${currentStatus}" на "${newStatus}"`, 400);
  }

  // Client can only cancel their own orders
  if (changeSource === 'client_action') {
    if (order.userId !== changedBy) {
      throw new OrderError('Замовлення не знайдено', 404);
    }
    if (newStatus !== 'cancelled' || !CLIENT_CANCELLABLE.includes(currentStatus)) {
      throw new OrderError(
        'Ви можете скасувати замовлення лише в статусах "Нове" або "В обробці"',
        403,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Restore stock when order is cancelled or returned. If the conditional
    // status update below fails, the whole transaction rolls back and these
    // increments are undone too.
    if (newStatus === 'cancelled' || newStatus === 'returned') {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
    }

    // Release the warehouse reservation once the units have either left the
    // building (`shipped`) or are no longer promised to a customer
    // (`cancelled`/`returned`). Without this, reserved counters drift up over
    // time and overstate commitment.
    if (newStatus === 'shipped' || newStatus === 'cancelled' || newStatus === 'returned') {
      await adjustReserved(
        tx,
        order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        -1,
      );
    }

    // Sync paymentStatus when the lifecycle status implies a payment fact:
    //  - `paid`: money received → paymentStatus = 'paid' (and stamp paidAt on
    //    the payment record so the receipt block in the UI lights up).
    //  - `cancelled`/`returned` on a previously-paid order: do NOT auto-refund —
    //    refunds are a financial operation that must go through the dedicated
    //    /refund endpoint (which records provider transaction id, amount, etc).
    const setPaymentPaid = newStatus === 'paid' && order.paymentStatus !== 'paid';
    const paymentUpdates: Prisma.OrderUpdateInput = {
      status: newStatus as Prisma.EnumOrderStatusFieldUpdateOperationsInput['set'],
      ...(setPaymentPaid && { paymentStatus: 'paid' }),
      ...(newStatus === 'cancelled' && {
        cancelledReason: comment,
        // Store WHO cancelled (user id), not the source kind — needed for audit.
        // Falls back to the source label for system/cron where there's no user.
        cancelledBy: changedBy != null ? String(changedBy) : changeSource,
      }),
    };

    // Optimistic lock: scope the UPDATE to `status = currentStatus` so two
    // managers clicking different transitions on the same order can't both
    // pass the transition-matrix check and produce duplicate statusHistory
    // rows. The loser sees a 409 and is told to refresh.
    const updateResult = await tx.order.updateMany({
      where: { id: orderId, status: currentStatus },
      data: paymentUpdates,
    });

    if (updateResult.count === 0) {
      throw new OrderError(
        'Статус замовлення вже змінили — оновіть сторінку та спробуйте ще раз.',
        409,
      );
    }

    // Stamp the Payment row so the order page's paidAt badge lights up. This
    // is a manual confirmation by an admin (cash in hand, bank transfer
    // received, etc) — no provider transaction id, no receipt URL. The admin
    // can attach those later via the payment management UI.
    if (setPaymentPaid) {
      const now = new Date();
      await tx.payment.upsert({
        where: { orderId },
        update: {
          paidAt: now,
          paymentStatus: 'paid',
          ...(changedBy ? { confirmedBy: changedBy } : {}),
        },
        create: {
          orderId,
          paymentMethod: order.paymentMethod,
          paymentStatus: 'paid',
          amount: order.totalAmount,
          paidAt: now,
          ...(changedBy ? { confirmedBy: changedBy } : {}),
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        oldStatus: currentStatus,
        newStatus,
        changedBy,
        changeSource,
        comment,
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: orderDetailSelect,
    });
  });

  // Сповіщення клієнту про новий статус. Best-effort: жодних throw — якщо
  // запис у user_notifications падає, оновлення статусу не повинно ламатися.
  if (updated.userId) {
    import('@/services/notification')
      .then((mod) =>
        mod.notifyOrderStatusChange(updated.userId!, updated.orderNumber, newStatus, updated.id),
      )
      .catch(() => {
        /* silent */
      });
  }

  // Manual "mark paid" (e.g. bank transfer received) — release dropship orders
  // to suppliers now that money is in. Idempotent on Order.dropshipNotifiedAt, so
  // this never double-sends with the COD-on-create or online-callback triggers.
  if (newStatus === 'paid') {
    import('@/services/suppliers/dropship-notify')
      .then((mod) => mod.notifyDropshipForOrder(updated.id))
      .catch(() => {
        /* best-effort */
      });
  }

  // Auto-create TTN when status changes to "confirmed" or "shipped" (Nova Poshta only).
  // We fire on confirmed so TTN exists ASAP — менеджеру більше не треба клацати "Створити ТТН".
  if (
    (newStatus === 'confirmed' || newStatus === 'shipped') &&
    !updated.trackingNumber &&
    updated.deliveryMethod === 'nova_poshta'
  ) {
    import('@/services/nova-poshta')
      .then(async (np) => {
        try {
          // Read Nova Poshta sender config from site settings
          const settings = await prisma.siteSetting.findMany({
            where: { key: { startsWith: 'delivery_nova_poshta_' } },
          });
          const config: Record<string, string> = {};
          settings.forEach((s) => {
            config[s.key.replace('delivery_nova_poshta_', '')] = s.value;
          });
          if (!config.api_key) return;

          // For COD orders the recipient pays at warehouse — pass cod amount so NP collects it.
          const isCOD = updated.paymentMethod === 'cod' && updated.paymentStatus !== 'paid';
          const codAmount = isCOD ? Number(updated.totalAmount) : undefined;
          // D2D if structured street/building present; otherwise warehouse delivery.
          const isD2D = !!updated.deliveryStreetRef && !!updated.deliveryBuilding;

          const result = await np.createInternetDocument({
            senderRef: config.sender_ref || '',
            senderAddressRef: config.sender_warehouse_ref || '',
            senderContactRef: config.sender_ref || '',
            senderPhone: config.sender_phone || '',
            recipientName: updated.contactName,
            recipientPhone: updated.contactPhone,
            recipientCityRef: updated.deliveryCity || '',
            recipientWarehouseRef: !isD2D ? updated.deliveryWarehouseRef || undefined : undefined,
            recipientStreetRef: isD2D ? updated.deliveryStreetRef || undefined : undefined,
            recipientBuilding: isD2D ? updated.deliveryBuilding || undefined : undefined,
            recipientFlat: isD2D ? updated.deliveryFlat || undefined : undefined,
            payerType: updated.paymentStatus === 'paid' ? 'Sender' : 'Recipient',
            paymentMethod: updated.paymentStatus === 'paid' ? 'NonCash' : 'Cash',
            cargoType: 'Parcel',
            weight: Math.max(
              0.5,
              updated.items.reduce(
                (sum: number, item: { quantity: number }) => sum + item.quantity * 0.3,
                0,
              ),
            ),
            seatsAmount: 1,
            description: `Замовлення #${updated.orderNumber}`,
            cost: Number(updated.totalAmount),
            serviceType: isD2D ? 'WarehouseDoors' : 'WarehouseWarehouse',
            codAmount,
          });

          if (result.intDocNumber) {
            await prisma.order.update({
              where: { id: orderId },
              data: { trackingNumber: result.intDocNumber },
            });
            logger.info('Auto-created TTN', {
              ttn: result.intDocNumber,
              orderNumber: updated.orderNumber,
            });

            // For marketplace orders, the moment we have a TTN the package is
            // effectively shipped — push that status back so the buyer sees
            // movement and the marketplace stops counting against SLA.
            if (updated.source) {
              import('@/services/marketplace-sync')
                .then((mod) => mod.pushOrderStatusToMarketplace(orderId, 'shipped'))
                .catch((err) =>
                  logger.error('Auto-shipped push to marketplace failed', {
                    orderNumber: updated.orderNumber,
                    error: String(err),
                  }),
                );
            }
          }
        } catch (err) {
          logger.error('Auto-TTN failed', { orderNumber: updated.orderNumber, error: String(err) });
        }
      })
      .catch((err) => {
        // Outer catch covers dynamic import failure and any throw before the
        // inner try — rare, but if it ever fires we need it in logs to know
        // why a confirmed/shipped NP order didn't get an auto-TTN.
        logger.error('Auto-TTN module load failed', {
          orderNumber: updated.orderNumber,
          error: String(err),
        });
      });
  }

  // Notify client about status change via Telegram. Best-effort: log on
  // failure rather than swallowing so an outage in Telegram delivery is
  // visible without sinking the status update.
  if (order.userId) {
    import('@/services/telegram')
      .then((mod) =>
        mod.notifyClientStatusChange(
          order.userId!,
          updated.orderNumber,
          currentStatus,
          newStatus,
          updated.trackingNumber,
        ),
      )
      .catch((err) => {
        logger.error('Telegram status notification failed', {
          orderNumber: updated.orderNumber,
          userId: order.userId,
          error: String(err),
        });
      });
  }

  // B2B: when confirmed, auto-generate invoice PDF and email it to legal-entity buyer.
  if (
    newStatus === 'confirmed' &&
    (updated.companyName || updated.edrpou) &&
    updated.contactEmail
  ) {
    Promise.all([import('@/services/pdf'), import('@/services/email')])
      .then(async ([pdfMod, emailMod]) => {
        try {
          const url = await pdfMod.generateInvoicePdf(orderId);
          const fs = await import('fs/promises');
          const path = await import('path');
          const fullPath = path.join(
            process.env.UPLOAD_DIR || './uploads',
            url.replace('/uploads/', ''),
          );
          const content = await fs.readFile(fullPath);

          // Escape user-provided fields before embedding into HTML email body
          // to prevent XSS via crafted companyName.
          const escapeHtml = (s: string): string =>
            s
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');

          const safeCompany = updated.companyName ? escapeHtml(updated.companyName) : '';
          const safeOrderNumber = escapeHtml(updated.orderNumber);

          await emailMod.sendEmail({
            to: updated.contactEmail,
            subject: `Рахунок-фактура за замовленням #${updated.orderNumber}`,
            html: `<p>Доброго дня${safeCompany ? `, ${safeCompany}` : ''}!</p>
              <p>У вкладенні — рахунок-фактура за замовленням <strong>#${safeOrderNumber}</strong>.</p>
              <p>Реквізити для оплати вказані у документі. У разі питань — звертайтесь.</p>`,
            attachments: [
              {
                filename: `invoice_${updated.orderNumber}.pdf`,
                content,
                contentType: 'application/pdf',
              },
            ],
          });
        } catch (err) {
          logger.error('B2B auto-invoice email failed', {
            orderNumber: updated.orderNumber,
            error: String(err),
          });
        }
      })
      .catch((err) => {
        logger.error('B2B auto-invoice module load failed', {
          orderNumber: updated.orderNumber,
          error: String(err),
        });
      });
  }

  // Loyalty: earn points on completion, handle referral status.
  // Base = cash actually collected for goods only:
  //   totalAmount already excludes the loyalty discount (post Fix #1), but
  //   still includes delivery. Subtracting deliveryCost gives the goods cash.
  //   We don't reward customers for paying us to ship — and we definitely don't
  //   want to keep earning points on a discount they spent the points for.
  if (newStatus === 'completed' && order.userId) {
    const pointsBase = Math.max(0, Number(updated.totalAmount) - Number(updated.deliveryCost ?? 0));
    import('@/services/loyalty')
      .then((mod) => mod.earnPoints(order.userId!, orderId, pointsBase))
      .catch((err) => {
        // Silent failure here would mean a paying customer never gets their
        // loyalty points — surface it so support can reconcile manually.
        logger.error('Loyalty earnPoints failed', {
          orderNumber: updated.orderNumber,
          userId: order.userId,
          pointsBase,
          error: String(err),
        });
      });

    // Update referral status and award bonuses (referrer + referee).
    // Bonus amounts come from SiteSettings (admin-configurable) — both can
    // be set to "0" to disable. Use a conditional updateMany (status=
    // 'registered') to atomically claim the bonus — a parallel completion of
    // another first order or a manual /admin/referrals/[id]/bonus call can't
    // both pass. The loser sees count === 0 and exits without double-paying.
    prisma.referral
      .findFirst({
        where: { referredUserId: order.userId, status: 'registered' },
        select: { id: true, referrerUserId: true, referredUserId: true },
      })
      .then(async (referral) => {
        if (!referral) return;

        const claimed = await prisma.referral.updateMany({
          where: { id: referral.id, status: 'registered' },
          data: { status: 'first_order', convertedAt: new Date() },
        });
        if (claimed.count === 0) return; // lost the race — another flow already took it

        const settingsMod = await import('@/services/settings');
        const settings = await settingsMod.getSettings();
        const referrerBonus = Math.max(
          0,
          Math.floor(Number(settings.referral_referrer_bonus) || 0),
        );
        const refereeBonus = Math.max(0, Math.floor(Number(settings.referral_referee_bonus) || 0));

        const loyaltyMod = await import('@/services/loyalty');
        if (referrerBonus > 0) {
          await loyaltyMod.adjustPoints({
            userId: referral.referrerUserId,
            type: 'manual_add',
            points: referrerBonus,
            description: `Реферальний бонус: запрошений користувач зробив перше замовлення #${orderId}`,
          });
        }
        // Referee gets a one-time bonus on their first order (not on signup —
        // would otherwise be farmed by people registering and never buying).
        if (refereeBonus > 0) {
          await loyaltyMod.adjustPoints({
            userId: referral.referredUserId,
            type: 'manual_add',
            points: refereeBonus,
            description: `Бонус за перше замовлення з реферальним кодом #${orderId}`,
          });
        }

        await prisma.referral.updateMany({
          where: { id: referral.id, status: 'first_order' },
          data: {
            status: 'bonus_granted',
            bonusType: 'points',
            bonusValue: referrerBonus,
          },
        });
      })
      .catch((err) => {
        logger.error('Referral first-order bonus failed', {
          orderNumber: updated.orderNumber,
          referredUserId: order.userId,
          error: String(err),
        });
      });
  }

  // Loyalty on cancellation/return:
  //  - reverse any `earn` (we credited points the customer doesn't deserve)
  //  - refund any `spend` (the customer paid with points for goods they're
  //    not getting — without this, the points are gone forever and we get a
  //    support ticket)
  if ((newStatus === 'cancelled' || newStatus === 'returned') && order.userId) {
    import('@/services/loyalty')
      .then(async (mod) => {
        const { prisma: db } = await import('@/lib/prisma');
        const txs = await db.loyaltyTransaction.findMany({
          where: { userId: order.userId!, orderId, type: { in: ['earn', 'spend'] } },
          select: { type: true, points: true },
        });

        const earned = txs.filter((t) => t.type === 'earn').reduce((sum, t) => sum + t.points, 0);
        // `spend` transactions are stored NEGATIVE (loyalty.ts: points: -points),
        // so sum to a non-positive number — take the absolute value of what was
        // spent. The previous `spent > 0` guard was never true, so customers who
        // paid with points and then cancelled/returned silently lost them.
        const spent = Math.abs(
          txs.filter((t) => t.type === 'spend').reduce((sum, t) => sum + t.points, 0),
        );

        if (earned > 0) {
          await mod.adjustPoints({
            userId: order.userId!,
            type: 'manual_deduct',
            points: earned,
            description: `Повернення нарахованих балів: замовлення #${orderId} ${newStatus === 'cancelled' ? 'скасовано' : 'повернено'}`,
          });
        }
        if (spent > 0) {
          await mod.adjustPoints({
            userId: order.userId!,
            type: 'manual_add',
            points: spent,
            description: `Повернення витрачених балів: замовлення #${orderId} ${newStatus === 'cancelled' ? 'скасовано' : 'повернено'}`,
          });
        }
      })
      .catch((err) => {
        logger.error('Loyalty reverse failed', {
          orderNumber: updated.orderNumber,
          userId: order.userId,
          newStatus,
          error: String(err),
        });
      });
  }

  // Release any coupon redeemed for this order when it's cancelled/returned —
  // free the global + per-user usage slot and re-activate an auto-disabled
  // single-use coupon. Without this a cancel permanently burns the code.
  if (newStatus === 'cancelled' || newStatus === 'returned') {
    import('@/lib/prisma')
      .then(async ({ prisma: db }) => {
        const redemptions = await db.couponRedemption.findMany({
          where: { orderId },
          select: { id: true, couponId: true },
        });
        for (const r of redemptions) {
          // Re-activate ONLY if the coupon was auto-disabled by hitting its
          // usage limit (freeing a slot makes it usable again). Do NOT flip
          // isActive for a coupon an admin deliberately disabled — read state
          // first and decide.
          const coupon = await db.coupon.findUnique({
            where: { id: r.couponId },
            select: { usageLimit: true, usedCount: true, isActive: true },
          });
          const wasLimitDisabled =
            !!coupon &&
            !coupon.isActive &&
            coupon.usageLimit != null &&
            coupon.usedCount >= coupon.usageLimit;
          await db.$transaction([
            db.coupon.update({
              where: { id: r.couponId },
              data: {
                usedCount: { decrement: 1 },
                ...(wasLimitDisabled ? { isActive: true } : {}),
              },
            }),
            db.couponRedemption.delete({ where: { id: r.id } }),
          ]);
        }
      })
      .catch((err) => {
        logger.error('Coupon release on cancel failed', {
          orderNumber: updated.orderNumber,
          newStatus,
          error: String(err),
        });
      });
  }

  // Push status update back to the marketplace if this order originated there.
  import('@/services/marketplace-sync')
    .then((mod) => mod.pushOrderStatusToMarketplace(orderId, newStatus))
    .catch((err) => {
      logger.error('Marketplace status push failed', {
        orderNumber: updated.orderNumber,
        error: String(err),
      });
    });

  // Status change touches every stat counter (new_order/processing/unpaid),
  // so invalidate so the next poll reflects reality.
  invalidateOrderStatsCache();

  return updated;
}

/**
 * @description Редагування позицій замовлення менеджером: додавання, видалення, зміна кількості товарів.
 * @param orderId - Ідентифікатор замовлення
 * @param items - Масив змін (itemId для оновлення/видалення, productId для додавання)
 * @param changedBy - ID менеджера, який вносить зміни
 * @returns Оновлене замовлення з деталями
 */
export async function editOrderItems(
  orderId: number,
  items: { itemId?: number; productId?: number; quantity: number; remove?: boolean }[],
  changedBy: number,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      clientType: true,
      deliveryCost: true,
      deliveryMethod: true,
      discountAmount: true,
      userId: true,
      user: { select: { wholesaleGroup: true } },
      items: {
        select: {
          id: true,
          productId: true,
          productCode: true,
          productName: true,
          priceAtOrder: true,
          quantity: true,
          subtotal: true,
          isPromo: true,
        },
      },
    },
  });

  if (!order) {
    throw new OrderError('Замовлення не знайдено', 404);
  }

  // Cannot edit items after payment has been confirmed
  if (order.paymentStatus === 'paid') {
    throw new OrderError('Редагування позицій неможливе: замовлення вже оплачено', 400);
  }

  // Can only edit items in early statuses
  if (!['new_order', 'processing', 'confirmed'].includes(order.status)) {
    throw new OrderError(
      'Редагування позицій можливе тільки для замовлень у статусах: Нове, В обробці, Підтверджено',
      400,
    );
  }

  // Pricing tier for new items added to an existing order. Matches the same
  // wholesale-group logic the storefront cart uses so adding a row in admin
  // doesn't quietly downgrade a B2B customer to retail price.
  const wholesaleGroup =
    order.clientType === 'wholesale' && typeof order.user?.wholesaleGroup === 'number'
      ? order.user.wholesaleGroup
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    for (const change of items) {
      if (change.remove && change.itemId) {
        // Remove item — restore stock and release reservation.
        const existing = order.items.find((i) => i.id === change.itemId);
        if (existing && existing.productId) {
          await tx.product.update({
            where: { id: existing.productId },
            data: { quantity: { increment: existing.quantity } },
          });
          await adjustReserved(
            tx,
            [{ productId: existing.productId, quantity: existing.quantity }],
            -1,
          );
        }
        await tx.orderItem.delete({ where: { id: change.itemId } });
      } else if (change.itemId) {
        // Update quantity of existing item
        const existing = order.items.find((i) => i.id === change.itemId);
        if (!existing) continue;

        const qtyDiff = change.quantity - existing.quantity;
        if (qtyDiff !== 0 && existing.productId) {
          if (qtyDiff > 0) {
            // Atomic conditional decrement — prevents the classic check-then-decrement
            // race where two concurrent orders both pass the stock check before either
            // commits the decrement. updateMany with `quantity: { gte: qtyDiff }` will
            // affect 0 rows if stock has already dropped below the threshold.
            const updated = await tx.product.updateMany({
              where: { id: existing.productId, quantity: { gte: qtyDiff } },
              data: { quantity: { decrement: qtyDiff } },
            });
            if (updated.count === 0) {
              throw new OrderError(`Недостатньо товару "${existing.productName}" на складі`, 400);
            }
          } else {
            await tx.product.update({
              where: { id: existing.productId },
              data: { quantity: { decrement: qtyDiff } },
            });
          }
          // Reservation tracks "how much is promised to open orders" — move it
          // by the same delta so reserved stays consistent with product.quantity.
          await adjustReserved(
            tx,
            [{ productId: existing.productId, quantity: Math.abs(qtyDiff) }],
            qtyDiff > 0 ? 1 : -1,
          );
        }

        // Round to 2 decimals so float drift doesn't accumulate into totals
        // for high-value orders (e.g. 17.99 × 1000 in JS float ≠ 17990.00).
        const newSubtotal = Math.round(Number(existing.priceAtOrder) * change.quantity * 100) / 100;
        await tx.orderItem.update({
          where: { id: change.itemId },
          data: { quantity: change.quantity, subtotal: newSubtotal },
        });
      } else if (change.productId && change.quantity > 0) {
        // Add new product
        const product = await tx.product.findUnique({
          where: { id: change.productId },
          select: {
            id: true,
            code: true,
            barcode: true,
            name: true,
            priceRetail: true,
            priceWholesale: true,
            priceWholesale2: true,
            priceWholesale3: true,
            quantity: true,
            supplierId: true,
            cost: true,
          },
        });

        if (!product) throw new OrderError('Товар не знайдено', 404);
        if (product.quantity < change.quantity) {
          throw new OrderError(`Недостатньо товару "${product.name}" на складі`, 400);
        }

        // Pick the tier matching the customer's wholesale group; fall back to
        // retail if the tier is unset for this product (e.g. only group 1
        // has a wholesale price).
        let unitPrice = Number(product.priceRetail);
        if (wholesaleGroup === 1 && product.priceWholesale != null) {
          unitPrice = Number(product.priceWholesale);
        } else if (wholesaleGroup === 2 && product.priceWholesale2 != null) {
          unitPrice = Number(product.priceWholesale2);
        } else if (wholesaleGroup === 3 && product.priceWholesale3 != null) {
          unitPrice = Number(product.priceWholesale3);
        }

        await tx.product.update({
          where: { id: product.id },
          data: { quantity: { decrement: change.quantity } },
        });
        await adjustReserved(tx, [{ productId: product.id, quantity: change.quantity }], 1);

        await tx.orderItem.create({
          data: {
            orderId,
            productId: product.id,
            productCode: product.code,
            productBarcode: product.barcode,
            productName: product.name,
            priceAtOrder: unitPrice,
            quantity: change.quantity,
            subtotal: Math.round(unitPrice * change.quantity * 100) / 100,
            isPromo: false,
            // Reconciliation snapshot for supplier-owned goods added manually.
            supplierId: product.supplierId,
            supplierCostAtSale: product.cost,
          },
        });
      }
    }

    // Recalculate totals. Items subtotal + delivery − discount, matching the
    // formula createOrder uses. Recompute deliveryCost against the new
    // items-subtotal so the free-shipping threshold flips correctly when
    // the customer drops items below it.
    const updatedItems = await tx.orderItem.findMany({
      where: { orderId },
      select: { quantity: true, subtotal: true },
    });

    if (updatedItems.length === 0) {
      throw new OrderError(
        'У замовленні має бути хоча б одна позиція. Скасуйте замовлення замість видалення всіх товарів.',
        400,
      );
    }

    const itemsSubtotal = sumMoney(updatedItems.map((i) => Number(i.subtotal)));
    let newDeliveryCost = Number(order.deliveryCost ?? 0);
    if (order.deliveryMethod && order.deliveryMethod !== 'pallet') {
      try {
        newDeliveryCost = await calculateDeliveryCost(
          order.deliveryMethod as DeliveryMethod,
          itemsSubtotal,
        );
      } catch {
        // Keep the original deliveryCost if recompute fails — don't block the
        // edit on a Nova-Poshta API hiccup.
      }
    }
    // Clamp the discount so a manager removing items can't drive totalAmount
    // negative. The most-favourable-to-customer behaviour is "keep the
    // existing discount up to the new gross", not "carry forward 50 UAH of
    // discount on a 30 UAH order".
    const grossTotal = addMoney(itemsSubtotal, newDeliveryCost);
    const originalDiscount = Number(order.discountAmount ?? 0);
    const cappedDiscount = Math.max(0, Math.min(originalDiscount, grossTotal));
    const totalAmount = subtractMoney(grossTotal, cappedDiscount);
    const itemsCount = updatedItems.reduce((sum, i) => sum + i.quantity, 0);

    // Add status history entry
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        oldStatus: order.status,
        newStatus: order.status,
        changedBy,
        changeSource: 'manager',
        comment: 'Позиції замовлення відредаговано',
      },
    });

    return tx.order.update({
      where: { id: orderId },
      data: {
        totalAmount,
        itemsCount,
        deliveryCost: newDeliveryCost,
        // Persist the clamped discount so the order detail page agrees with
        // the value used in totalAmount.
        ...(cappedDiscount !== originalDiscount && { discountAmount: cappedDiscount }),
      },
      select: orderDetailSelect,
    });
  });

  return updated;
}

/**
 * @description Отримує всі замовлення з фільтрами та пагінацією (для адміністратора).
 * @param filters - Фільтри (статус, пошук, дати, пагінація)
 * @returns Об'єкт зі списком замовлень та загальною кількістю
 */
export async function getAllOrders(filters: OrderFilterInput) {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.clientType) {
    where.clientType = filters.clientType;
  }
  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }
  if (filters.deliveryMethod) {
    where.deliveryMethod = filters.deliveryMethod;
  }
  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus;
  }
  if (filters.assignedManagerId) {
    where.assignedManagerId = filters.assignedManagerId;
  }
  if (filters.search) {
    // Phone variants let "0961234567" match a stored "+380961234567" (and vice versa).
    const phoneVariants = phoneSearchVariants(filters.search);
    where.OR = [
      { orderNumber: { contains: filters.search, mode: 'insensitive' } },
      { contactName: { contains: filters.search, mode: 'insensitive' } },
      ...phoneVariants.map((v) => ({
        contactPhone: { contains: v, mode: 'insensitive' as const },
      })),
      { trackingNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.dateFrom) {
    // "YYYY-MM-DD" is a Kyiv calendar day; anchor the lower bound to Kyiv 00:00
    // (DST-aware) so the shop's local day is what's filtered, not the UTC day.
    where.createdAt = { ...(where.createdAt as object), gte: kyivMidnightUtc(filters.dateFrom) };
  }
  if (filters.dateTo) {
    // Include all of the Kyiv day: lower bound is Kyiv 00:00 of the *next* day,
    // matched with `lt` so "до 14 травня" includes every order on May 14.
    const nextDay = new Date(`${filters.dateTo}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    where.createdAt = {
      ...(where.createdAt as object),
      lt: kyivMidnightUtc(nextDay.toISOString().slice(0, 10)),
    };
  }

  const skip = (filters.page - 1) * filters.limit;
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        ...orderListSelect,
        contactEmail: true,
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

/**
 * Pack & Pick — fetches orders ready for packing (confirmed or paid, not
 * shipped) with the minimum item shape the warehouse worker needs: a stable
 * id for ticking off, the product barcode (for scanner matching), and the
 * internal SKU (for manual fallback).
 */
export async function getPackableOrders(limit = 50) {
  // Include "packed" so an operator who packed yesterday but didn't hand
  // the box to the courier yet still sees the order on the list today.
  const orders = await prisma.order.findMany({
    where: { status: { in: ['confirmed', 'paid', 'packed'] } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      clientType: true,
      contactName: true,
      contactPhone: true,
      totalAmount: true,
      trackingNumber: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productId: true,
          productCode: true,
          productName: true,
          quantity: true,
          product: {
            select: {
              barcode: true,
              quantity: true, // total stock on hand — UI greys out missing items
              warehouseStock: {
                select: {
                  quantity: true,
                  warehouse: { select: { name: true, code: true } },
                },
                where: { quantity: { gt: 0 } },
                orderBy: { quantity: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  // Flatten warehouse info onto the item for an easier UI shape. The first
  // warehouse with stock > 0 is "where to pick from"; falls back to null
  // (operator already knows the item is missing because stockOnHand is 0).
  return orders.map((o) => ({
    ...o,
    items: o.items.map((it) => ({
      ...it,
      productBarcode: it.product?.barcode ?? null,
      stockOnHand: it.product?.quantity ?? 0,
      locationCode: it.product?.warehouseStock?.[0]?.warehouse?.code ?? null,
      locationName: it.product?.warehouseStock?.[0]?.warehouse?.name ?? null,
    })),
  }));
}

export interface OrderStats {
  newOrders: number;
  processingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  unpaidOrders: number;
}

export async function getOrderStats(): Promise<OrderStats> {
  // Short Redis cache: N admin tabs polling every 30s collapse onto one
  // round of aggregations per cache window. Stats are inherently lagging
  // (10s polling already), so 15s extra staleness is invisible to users
  // and saves 5 aggregation queries × N tabs × every poll cycle.
  try {
    const cached = await redis.get(STATS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as OrderStats;
    }
  } catch {
    // Redis down — fall through and compute fresh.
  }

  // Kyiv midnight, not the server's (UTC) midnight — otherwise "today's orders"
  // silently drops orders placed between Kyiv 00:00 and 02:00–03:00.
  const today = todayKyiv();

  const [totalNew, totalProcessing, totalToday, revenueToday, totalUnpaid] = await Promise.all([
    prisma.order.count({ where: { status: 'new_order' } }),
    prisma.order.count({ where: { status: 'processing' } }),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: today }, status: { notIn: ['cancelled', 'returned'] } },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        paymentStatus: 'pending',
        status: { notIn: ['cancelled', 'returned', 'completed'] },
      },
    }),
  ]);

  const stats: OrderStats = {
    newOrders: totalNew,
    processingOrders: totalProcessing,
    todayOrders: totalToday,
    todayRevenue: Number(revenueToday._sum.totalAmount ?? 0),
    unpaidOrders: totalUnpaid,
  };

  // Fire-and-forget cache write; failure here just means the next caller
  // recomputes — never block the response on Redis.
  redis
    .setex(STATS_CACHE_KEY, STATS_CACHE_TTL, JSON.stringify(stats))
    .catch((err) => logger.error('Order stats cache write failed', { error: String(err) }));

  return stats;
}

/** Drop the cached stats — call after order create / status change so the
 * next /admin/orders poll sees a fresh "new orders" count without waiting
 * for the TTL to expire. */
export async function invalidateOrderStatsCache(): Promise<void> {
  try {
    await redis.del(STATS_CACHE_KEY);
  } catch {
    // Cache miss next time is the worst case — never fail the caller.
  }
}
