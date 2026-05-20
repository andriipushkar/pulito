import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: { ordersCount: true, quantity: true, viewsCount: true },
    });
    if (!p) return errorResponse('Товар не знайдено', 404);
    return successResponse(p);
  } catch (error) {
    console.error('[Quick stats product]', error);
    return errorResponse('Помилка', 500);
  }
});
