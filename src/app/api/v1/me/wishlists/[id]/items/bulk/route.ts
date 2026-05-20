import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import {
  resolveWishlistId,
  getWishlistedProductIds,
  WishlistError,
} from '@/services/wishlist';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * GET /api/v1/me/wishlists/[id]/items/bulk?ids=1,2,3
 * Returns the subset of provided productIds that are present in the wishlist.
 * Lets catalog pages collapse N per-card requests into a single call.
 */
export const GET = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const wishlistId = await resolveWishlistId(user.id, id);

    const idsParam = request.nextUrl.searchParams.get('ids') ?? '';
    const ids = idsParam
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return successResponse({ wishlisted: [] });
    }
    if (ids.length > 200) {
      return errorResponse('Забагато ID — максимум 200', 400);
    }

    const wishlisted = await getWishlistedProductIds(wishlistId, ids);
    return successResponse({ wishlisted });
  } catch (error) {
    if (error instanceof WishlistError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
