import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { updateCartItem, removeFromCart, CartError } from '@/services/cart';
import { updateCartItemSchema } from '@/validators/order';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

function parseProductId(raw: string): number | null {
  const n = Number(raw);
  // `isNaN(-5) === false`, so the original check let negatives reach the
  // service. Require finite positive ints to match the FK type.
  return Number.isFinite(n) && n > 0 && Number.isInteger(n) ? n : null;
}

export const PUT = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { productId } = await params!;
    const numProductId = parseProductId(productId);
    if (numProductId === null) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = updateCartItemSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const item = await updateCartItem(user.id, numProductId, parsed.data.quantity);
    return successResponse(item);
  } catch (error) {
    if (error instanceof CartError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const { productId } = await params!;
    const numProductId = parseProductId(productId);
    if (numProductId === null) return errorResponse('Невалідний ID', 400);

    await removeFromCart(user.id, numProductId);
    return successResponse({ message: 'Видалено' });
  } catch (error) {
    if (error instanceof CartError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
