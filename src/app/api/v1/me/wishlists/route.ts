import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';
import {
  getUserWishlists,
  createWishlist,
  deleteEmptyWishlists,
  WishlistError,
} from '@/services/wishlist';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const wishlists = await getUserWishlists(user.id);
    return privateResponse(wishlists);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

const createSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(100),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Per-customer cap on wishlist creation rate. Without this a scripted
    // client churns wishlists at line speed.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const wishlist = await createWishlist(user.id, parsed.data.name);
    return successResponse(wishlist, 201);
  } catch (err) {
    if (err instanceof WishlistError) return errorResponse(err.message, err.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

// Bulk delete empty wishlists (keeps at least one)
export const DELETE = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }
    const deleted = await deleteEmptyWishlists(user.id);
    return successResponse({ deleted });
  } catch (err) {
    console.error('[wishlists DELETE]', err);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
