import { NextRequest } from 'next/server';
import { z } from 'zod';
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
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';

// 200 covers a power user (bulk B2B order); beyond that a scripted client
// is the only realistic source — cap before Prisma `createMany` blows up.
const mergeCartSchema = z.object({
  mode: z.enum(['merge', 'replace']).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(10_000),
      }),
    )
    .max(200, 'Максимум 200 позицій у кошику'),
});

export const GET = createApiHandler(
  RATE_LIMITS.cart,
  withAuth(async (_request: NextRequest, { user }) => {
    try {
      const items = await getCartWithPersonalPrices(user.id);
      return privateResponse(items);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }),
);

export const POST = createApiHandler(
  RATE_LIMITS.cart,
  withAuth(async (request: NextRequest, { user }) => {
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
  }),
);

export const DELETE = createApiHandler(
  RATE_LIMITS.cart,
  withAuth(async (_request: NextRequest, { user }) => {
    try {
      await clearCart(user.id);
      return successResponse({ message: 'Кошик очищено' });
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }),
);

export const PUT = createApiHandler(
  RATE_LIMITS.cart,
  withAuth(async (request: NextRequest, { user }) => {
    try {
      const body = await request.json();
      const parsed = mergeCartSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'items масив обовʼязковий', 422);
      }
      // Two modes:
      //  - "merge" (default) → preserve server items, add any local-only items.
      //    Used on first login when local cart should join the server cart.
      //  - "replace" → mirror the client list exactly. Used on checkout submit
      //    so items removed in the UI don't sneak back into the created order.
      const mode = parsed.data.mode === 'replace' ? 'replace' : 'merge';
      const items =
        mode === 'replace'
          ? await replaceCart(user.id, parsed.data.items)
          : await mergeCart(user.id, parsed.data.items);
      return successResponse(items);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }),
);
