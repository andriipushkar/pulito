import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { addBundleToCart, BundleError } from '@/services/bundle';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { slug } = await params!;

    const bundle = await prisma.bundle.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });

    if (!bundle) {
      return errorResponse('Комплект не знайдено', 404);
    }

    const cartItems = await addBundleToCart(user.id, bundle.id);
    return successResponse({ message: 'Комплект додано до кошика', items: cartItems }, 201);
  } catch (error) {
    if (error instanceof BundleError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
