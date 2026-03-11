import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withOptionalAuth } from '@/middleware/auth';
import { createOrder, getUserOrders, OrderError } from '@/services/order';
import { getCartWithPersonalPrices } from '@/services/cart';
import { spendPoints, LoyaltyError } from '@/services/loyalty';
import { getIdempotentResponse, setIdempotentResponse } from '@/services/idempotency';
import { checkoutSchema, guestCheckoutSchema, orderFilterSchema } from '@/validators/order';
import { successResponse, errorResponse, paginatedResponse } from '@/utils/api-response';
import { resolveWholesalePrice } from '@/lib/wholesale-price';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = orderFilterSchema.safeParse(params);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { orders, total } = await getUserOrders(user.id, parsed.data);
    return paginatedResponse(orders, total, parsed.data.page, parsed.data.limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    // Idempotency key support
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const cached = await getIdempotentResponse(idempotencyKey);
      if (cached) {
        return NextResponse.json(JSON.parse(cached), { status: 201 });
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

      const order = await createOrder(user.id, parsed.data, orderItems, clientType);

      // Handle loyalty points spending
      const loyaltyPointsToSpend = parsed.data.loyaltyPointsToSpend;
      if (loyaltyPointsToSpend && loyaltyPointsToSpend > 0) {
        try {
          await spendPoints(user.id, loyaltyPointsToSpend, order.id);
        } catch (error) {
          if (error instanceof LoyaltyError) {
            return successResponse({ ...order, loyaltyPointsError: error.message }, 201);
          }
        }
      }

      const paymentRequired = parsed.data.paymentMethod === 'online';
      const responseData = { ...order, paymentRequired };
      if (idempotencyKey) {
        await setIdempotentResponse(idempotencyKey, JSON.stringify({ success: true, data: responseData }));
      }
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
        select: { id: true, code: true, name: true, priceRetail: true, isPromo: true, quantity: true },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      const orderItems = [];

      for (const item of parsed.data.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          return errorResponse(`Товар з ID ${item.productId} не знайдено або недоступний`, 400);
        }
        if (product.quantity < item.quantity) {
          return errorResponse(`Недостатньо товару "${product.name}". Доступно: ${product.quantity} шт.`, 400);
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

      const order = await createOrder(null, parsed.data, orderItems, 'retail');

      const paymentRequired = parsed.data.paymentMethod === 'online';
      const responseData = { ...order, paymentRequired };
      if (idempotencyKey) {
        await setIdempotentResponse(idempotencyKey, JSON.stringify({ success: true, data: responseData }));
      }
      return successResponse(responseData, 201);
    }
  } catch (error) {
    if (error instanceof OrderError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
