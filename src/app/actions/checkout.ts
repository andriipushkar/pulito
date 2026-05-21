'use server';

import { createOrder, OrderError } from '@/services/order';
import { getCartWithPersonalPrices } from '@/services/cart';
import { spendPoints, LoyaltyError } from '@/services/loyalty';
import {
  getIdempotentResponse,
  updateIdempotentResponse,
  reserveIdempotencyKey,
} from '@/services/idempotency';
import { checkoutSchema } from '@/validators/order';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/services/token';
import { isAccessTokenBlacklisted } from '@/services/auth';
import { checkActionRateLimit, ACTION_LIMITS } from '@/lib/action-rate-limit';
import { cookies, headers } from 'next/headers';
import { logger } from '@/lib/logger';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const blacklisted = await isAccessTokenBlacklisted(token);
    if (blacklisted) return null;
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export interface CheckoutResult {
  success: boolean;
  error?: string;
  orderId?: number;
  orderNumber?: string;
  paymentRequired?: boolean;
}

export async function checkoutAction(
  _prevState: CheckoutResult,
  formData: FormData
): Promise<CheckoutResult> {
  // Rate limit: Server Actions bypass middleware, so we check here
  const rateLimitError = await checkActionRateLimit(ACTION_LIMITS.checkout);
  if (rateLimitError) {
    return { success: false, error: rateLimitError };
  }

  const user = await getAuthUser();
  if (!user) {
    return { success: false, error: 'Необхідно авторизуватися для оформлення замовлення' };
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === 'loyaltyPointsToSpend') {
      raw[key] = Number(value) || 0;
    } else {
      raw[key] = value;
    }
  }

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Idempotency key — atomically reserve so two concurrent submits with the
  // same key can't both pass the "no cached response" check and create two
  // orders. reserveIdempotencyKey does SET NX, so only one caller proceeds;
  // the others either get the cached response or are told "in flight".
  const headerStore = await headers();
  const idempotencyKey = headerStore.get('x-idempotency-key');
  if (idempotencyKey) {
    const reservation = await reserveIdempotencyKey(idempotencyKey);
    if ('cached' in reservation && reservation.cached) {
      try {
        const data = JSON.parse(reservation.cached);
        return { success: true, ...data };
      } catch {
        // Fall through to the legacy lookup if the cached payload is malformed.
        const cached = await getIdempotentResponse(idempotencyKey);
        if (cached) return { success: true, ...JSON.parse(cached) };
      }
    }
    if ('inFlight' in reservation && reservation.inFlight) {
      return {
        success: false,
        error: 'Замовлення вже обробляється, зачекайте кілька секунд',
      };
    }
  }

  try {
    const cartItems = await getCartWithPersonalPrices(user.id);
    if (cartItems.length === 0) {
      return { success: false, error: 'Кошик порожній' };
    }

    // Stock check
    for (const item of cartItems) {
      if (item.product.quantity < item.quantity) {
        return {
          success: false,
          error: `Недостатньо товару "${item.product.name}". Доступно: ${item.product.quantity} шт.`,
        };
      }
      if (!item.product.isActive) {
        return { success: false, error: `Товар "${item.product.name}" більше не доступний` };
      }
    }

    const clientType = user.role === 'wholesaler' ? 'wholesale' : 'retail';
    let wholesaleGroup: number | null = null;
    if (clientType === 'wholesale') {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { wholesaleGroup: true },
      });
      wholesaleGroup = dbUser?.wholesaleGroup ?? 1;
    }

    const orderItems = cartItems.map((item) => {
      let price: number;
      if (item.personalPrice !== null) {
        price = item.personalPrice;
      } else if (clientType === 'wholesale') {
        const resolved = resolveWholesalePrice(item.product, wholesaleGroup);
        price = resolved ?? Number(item.product.priceRetail);
      } else {
        price = Number(item.product.priceRetail);
      }
      return {
        productId: item.product.id,
        productCode: item.product.code,
        productName: item.product.name,
        price,
        quantity: item.quantity,
        isPromo: item.product.isPromo,
      };
    });

    // Loyalty points pre-validation
    const loyaltyPointsToSpend = parsed.data.loyaltyPointsToSpend;
    if (loyaltyPointsToSpend && loyaltyPointsToSpend > 0) {
      const userPoints = await prisma.loyaltyAccount.findUnique({
        where: { userId: user.id },
        select: { points: true },
      });
      if (!userPoints || userPoints.points < loyaltyPointsToSpend) {
        return {
          success: false,
          error: `Недостатньо балів. Доступно: ${userPoints?.points ?? 0}, запитано: ${loyaltyPointsToSpend}`,
        };
      }
    }

    // Pass loyaltyPointsToSpend so createOrder discounts totalAmount + writes
    // the discount line. Previously the value was deducted from the customer's
    // balance below but never reduced the order total — customer paid full
    // price AND lost their points.
    const order = await createOrder(
      user.id,
      parsed.data,
      orderItems,
      clientType,
      loyaltyPointsToSpend || 0,
    );

    // Spend loyalty points. If the deduction fails after the order is in
    // place we cannot easily roll back createOrder (stock has been
    // decremented, audit rows written) — so we cancel the order to keep
    // the customer's balance honest and surface a friendly error instead of
    // silently giving them a discount without spending points.
    if (loyaltyPointsToSpend && loyaltyPointsToSpend > 0) {
      try {
        await spendPoints(user.id, loyaltyPointsToSpend, order.id);
      } catch (error) {
        logger.error('Loyalty points spend failed after order creation — compensating', {
          userId: user.id,
          orderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Compensate: cancel the order so stock returns and customer isn't
        // billed for points they never spent. We use updateOrderStatus to go
        // through the proper state-history + stock-restore path.
        try {
          const { updateOrderStatus } = await import('@/services/order');
          await updateOrderStatus(
            order.id,
            'cancelled',
            null,
            'system',
            'Скасовано: не вдалось списати бали лояльності',
          );
        } catch (rollbackErr) {
          logger.error('Failed to compensate order after loyalty spend failure', {
            orderId: order.id,
            error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
          });
        }
        const msg =
          error instanceof LoyaltyError
            ? error.message
            : 'Не вдалося списати бали лояльності';
        return { success: false, error: msg };
      }
    }

    const paymentRequired = parsed.data.paymentMethod === 'online';
    const result = { orderId: order.id, orderNumber: order.orderNumber, paymentRequired };

    if (idempotencyKey) {
      // We already reserved the key with an in-flight marker above, so NX
      // would no-op here. updateIdempotentResponse overwrites the marker
      // with the real response so subsequent duplicate submits get the
      // cached order back.
      await updateIdempotentResponse(idempotencyKey, JSON.stringify(result));
    }

    // Server-side tracking (non-blocking)
    import('@/services/server-tracking').then((tracking) =>
      tracking.trackPurchase({
        userId: user.id,
        email: parsed.data.contactEmail,
        phone: parsed.data.contactPhone,
        orderId: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        items: orderItems.map((i) => ({
          id: String(i.productId),
          name: i.productName,
          price: i.price,
          quantity: i.quantity,
        })),
      })
    ).catch(() => {});

    return { success: true, ...result };
  } catch (error) {
    if (error instanceof OrderError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Помилка при створенні замовлення' };
  }
}
