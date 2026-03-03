import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { resolveWishlistId, isProductInWishlist, addItemToWishlist, removeItemFromWishlist, WishlistError } from '@/services/wishlist';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id, productId } = await params!;
    const wishlistId = await resolveWishlistId(user.id, id);
    const numProductId = Number(productId);
    if (isNaN(numProductId)) return errorResponse('Невалідний ID товару', 400);
    const wishlisted = await isProductInWishlist(user.id, wishlistId, numProductId);
    return successResponse({ wishlisted });
  } catch (error) {
    if (error instanceof WishlistError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id, productId } = await params!;
    const wishlistId = await resolveWishlistId(user.id, id);
    const numProductId = Number(productId);
    if (isNaN(numProductId)) return errorResponse('Невалідний ID товару', 400);
    const item = await addItemToWishlist(user.id, wishlistId, numProductId);
    return successResponse(item, 201);
  } catch (error) {
    if (error instanceof WishlistError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id, productId } = await params!;
    const wishlistId = await resolveWishlistId(user.id, id);
    const numProductId = Number(productId);
    if (isNaN(numProductId)) return errorResponse('Невалідний ID товару', 400);
    await removeItemFromWishlist(user.id, wishlistId, numProductId);
    return successResponse({ message: 'Товар видалено зі списку' });
  } catch (error) {
    if (error instanceof WishlistError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
