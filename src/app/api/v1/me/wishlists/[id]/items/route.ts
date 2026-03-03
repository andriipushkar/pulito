import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';
import { resolveWishlistId, addItemToWishlist, WishlistError } from '@/services/wishlist';
import { successResponse, errorResponse } from '@/utils/api-response';

const addSchema = z.object({ productId: z.number().int().positive() });

export const POST = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const wishlistId = await resolveWishlistId(user.id, id);
    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const item = await addItemToWishlist(user.id, wishlistId, parsed.data.productId);
    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof WishlistError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
