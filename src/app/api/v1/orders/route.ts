import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withOptionalAuth } from '@/middleware/auth';
import { createOrder, getUserOrders, updateOrderStatus, OrderError } from '@/services/order';
import { getCartWithPersonalPrices } from '@/services/cart';
import { spendPoints, LoyaltyError } from '@/services/loyalty';
import { reserveIdempotencyKey, updateIdempotentResponse } from '@/services/idempotency';
import { checkoutSchema, guestCheckoutSchema, orderFilterSchema } from '@/validators/order';
import { successResponse, errorResponse, privatePaginatedResponse } from '@/utils/api-response';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';

export const GET = createApiHandler(
  RATE_LIMITS.orders,
  withAuth(async (request: NextRequest, { user }) => {
    try {
      const params = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = orderFilterSchema.safeParse(params);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 400);
      }

      const { orders, total } = await getUserOrders(user.id, parsed.data);
      return privatePaginatedResponse(orders, total, parsed.data.page, parsed.data.limit);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }),
);

export const POST = createApiHandler(
  RATE_LIMITS.orders,
  withOptionalAuth(async (request: NextRequest, { user }) => {
    try {
      // Idempotency key support — atomic reserve closes the double-click race
      // where two requests both see "no cached response" and both create orders.
      const idempotencyKey = request.headers.get('x-idempotency-key');
      if (idempotencyKey) {
        const slot = await reserveIdempotencyKey(idempotencyKey);
        if (!slot.reserved) {
          if ('inFlight' in slot) {
            return errorResponse(
              'Замовлення вже опрацьовується. Зачекайте кілька секунд і перевірте список замовлень.',
              409,
            );
          }
          if (slot.cached) {
            return NextResponse.json(JSON.parse(slot.cached), { status: 201 });
          }
          return errorResponse('Це замовлення вже опрацьовано', 409);
        }
      }

      const body = await request.json();

      if (user) {
        // Authenticated checkout — use server cart
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(parsed.error.issues[0].message, 400);
        }

        const cartItems = await getCartWithPersonalPrices(user.id);
        if (cartItems.length === 0) {
          return errorResponse('Кошик порожній', 400);
        }

        // Re-validate stock for all cart items before creating order
        for (const item of cartItems) {
          if (item.product.quantity < item.quantity) {
            return errorResponse(
              `Недостатньо товару "${item.product.name}". Доступно: ${item.product.quantity} шт., у кошику: ${item.quantity} шт.`,
              400,
            );
          }
          if (!item.product.isActive) {
            return errorResponse(`Товар "${item.product.name}" більше не доступний`, 400);
          }
        }

        const clientType = user.role === 'wholesaler' ? 'wholesale' : 'retail';

        // Get user's wholesale group for price resolution
        let wholesaleGroup: number | null = null;
        if (clientType === 'wholesale') {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { wholesaleGroup: true },
          });
          wholesaleGroup = dbUser?.wholesaleGroup ?? 1;
        }

        const orderItems = cartItems.map((item) => {
          // Price priority:
          //  1. volumeDiscount.discountedPrice (merchant-set quantity-tier promo)
          //  2. personalPrice (admin-set per-user/per-category override)
          //  3. wholesale group tier (for B2B clients)
          //  4. priceRetail (default)
          // Volume wins because the merchant explicitly configured the discount
          // and it's already shown to the customer in the cart row — silently
          // applying personal/wholesale instead would mismatch the cart display.
          let price: number;
          if (item.volumeDiscount) {
            price = item.volumeDiscount.discountedPrice;
          } else if (item.personalPrice !== null) {
            price = item.personalPrice;
          } else if (clientType === 'wholesale') {
            const resolved = resolveWholesalePrice(item.product, wholesaleGroup);
            price = resolved ?? Number(item.product.priceRetail);
          } else {
            price = Number(item.product.priceRetail);
          }

          // Wholesale prices are SUBMITTED by the seller (not derived), so a
          // wholesale customer must never be charged above their submitted
          // wholesale price. Volume/personal still apply if LOWER, but the
          // wholesale tier is the ceiling — previously a volume discount
          // computed off RETAIL could exceed the wholesale price and overcharge
          // a B2B client.
          if (clientType === 'wholesale') {
            const wholesale = resolveWholesalePrice(item.product, wholesaleGroup);
            if (wholesale != null) price = Math.min(price, wholesale);
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

        // Validate loyalty points BEFORE creating order
        const loyaltyPointsToSpend = parsed.data.loyaltyPointsToSpend;
        if (loyaltyPointsToSpend && loyaltyPointsToSpend > 0) {
          const userPoints = await prisma.loyaltyAccount.findUnique({
            where: { userId: user.id },
            select: { points: true },
          });
          if (!userPoints || userPoints.points < loyaltyPointsToSpend) {
            return errorResponse(
              `Недостатньо балів. Доступно: ${userPoints?.points ?? 0}, запитано: ${loyaltyPointsToSpend}`,
              400,
            );
          }
        }

        const order = await createOrder(
          user.id,
          parsed.data,
          orderItems,
          clientType,
          loyaltyPointsToSpend ?? 0,
        );

        // Use the actually-applied discount from the created order (the service
        // clamps to the cart total) so we never debit more points than the
        // customer received as a discount.
        const pointsActuallySpent = Number(order.discountAmount);
        if (pointsActuallySpent > 0) {
          try {
            await spendPoints(user.id, pointsActuallySpent, order.id);
          } catch (error) {
            // Spend failed AFTER the order was created with the discount baked
            // into its total (the pre-check at line ~128 is a non-atomic read,
            // so a concurrent order can drain the balance in between). Without
            // compensation the customer would ship with a discount they never
            // paid for in points — silent revenue loss. Cancel the order so
            // stock is restored and surface a friendly retry error.
            logger.error('Loyalty points spend failed after order creation — compensating', {
              userId: user.id,
              orderId: order.id,
              error: error instanceof Error ? error.message : String(error),
            });
            try {
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
            return errorResponse(
              error instanceof LoyaltyError
                ? error.message
                : 'Не вдалося списати бали лояльності. Спробуйте ще раз.',
              400,
            );
          }
        }

        const paymentRequired = parsed.data.paymentMethod === 'online';
        const responseData = { ...order, paymentRequired };
        if (idempotencyKey) {
          await updateIdempotentResponse(
            idempotencyKey,
            JSON.stringify({ success: true, data: responseData }),
          );
        }

        // Server-side tracking (non-blocking)
        import('@/services/server-tracking')
          .then((tracking) =>
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
            }),
          )
          .catch(() => {});

        return successResponse(responseData, 201);
      } else {
        // Guest checkout — cart items in request body
        const parsed = guestCheckoutSchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(parsed.error.issues[0].message, 400);
        }

        // Resolve product details from DB
        const productIds = parsed.data.items.map((i) => i.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            priceRetail: true,
            isPromo: true,
            quantity: true,
            categoryId: true,
          },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        const orderItems = [];

        for (const item of parsed.data.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            return errorResponse(`Товар з ID ${item.productId} не знайдено або недоступний`, 400);
          }
          if (product.quantity < item.quantity) {
            return errorResponse(
              `Недостатньо товару "${product.name}". Доступно: ${product.quantity} шт.`,
              400,
            );
          }
          orderItems.push({
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            price: Number(product.priceRetail),
            quantity: item.quantity,
            isPromo: product.isPromo,
          });
        }

        // Apply volume (quantity-tier) discounts so a guest is charged the same
        // discounted unit price the cart/checkout UI showed them — previously
        // the guest path snapshotted full priceRetail and overcharged anyone
        // who hit a bulk tier.
        const { applyVolumeDiscounts } = await import('@/services/volume-pricing');
        const volumeResults = await applyVolumeDiscounts(
          orderItems.map((oi) => ({
            productId: oi.productId,
            categoryId: productMap.get(oi.productId)?.categoryId ?? null,
            quantity: oi.quantity,
            price: oi.price,
          })),
        );
        const volumeByProduct = new Map(volumeResults.map((v) => [v.productId, v]));
        for (const oi of orderItems) {
          const vd = volumeByProduct.get(oi.productId);
          if (vd && vd.discountedPrice < oi.price) oi.price = vd.discountedPrice;
        }

        const order = await createOrder(null, parsed.data, orderItems, 'retail');

        const paymentRequired = parsed.data.paymentMethod === 'online';
        const responseData = { ...order, paymentRequired };
        if (idempotencyKey) {
          await updateIdempotentResponse(
            idempotencyKey,
            JSON.stringify({ success: true, data: responseData }),
          );
        }
        return successResponse(responseData, 201);
      }
    } catch (error) {
      if (error instanceof OrderError) {
        return errorResponse(error.message, error.statusCode);
      }
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }),
);
