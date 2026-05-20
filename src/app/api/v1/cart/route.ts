import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import {
  getCartWithPersonalPrices,
  addToCart,
  clearCart,
  mergeCart,
  replaceCart,
} from '@/services/cart';
import { CartError } from '@/services/cart';
import { addToCartSchema } from '@/validators/order';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';

export const GET = createApiHandler(RATE_LIMITS.cart, withAuth(async (_request: NextRequest, { user }) => {
  try {
    const items = await getCartWithPersonalPrices(user.id);
    return successResponse(items);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}));

export const POST = createApiHandler(RATE_LIMITS.cart, withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }
    const item = await addToCart(user.id, parsed.data.productId, parsed.data.quantity);
    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof CartError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}));

export const DELETE = createApiHandler(RATE_LIMITS.cart, withAuth(async (_request: NextRequest, { user }) => {
  try {
    await clearCart(user.id);
    return successResponse({ message: 'Кошик очищено' });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}));

export const PUT = createApiHandler(RATE_LIMITS.cart, withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items)) {
      return errorResponse('items масив обовʼязковий', 400);
    }
    // Two modes:
    //  - "merge" (default) → preserve server items, add any local-only items.
    //    Used on first login when local cart should join the server cart.
    //  - "replace" → mirror the client list exactly. Used on checkout submit
    //    so items removed in the UI don't sneak back into the created order.
    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    const items =
      mode === 'replace'
        ? await replaceCart(user.id, body.items)
        : await mergeCart(user.id, body.items);
    return successResponse(items);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}));
