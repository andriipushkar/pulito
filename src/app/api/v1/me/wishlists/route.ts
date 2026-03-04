import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';
import { getUserWishlists, createWishlist, deleteEmptyWishlists } from '@/services/wishlist';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const wishlists = await getUserWishlists(user.id);
    return successResponse(wishlists);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

const createSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова').max(100),
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const wishlist = await createWishlist(user.id, parsed.data.name);
    return successResponse(wishlist, 201);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

// Bulk delete empty wishlists (keeps at least one)
export const DELETE = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const deleted = await deleteEmptyWishlists(user.id);
    return successResponse({ deleted });
  } catch (err) {
    console.error('[wishlists DELETE]', err);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
