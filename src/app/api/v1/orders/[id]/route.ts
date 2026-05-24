import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { getOrderById } from '@/services/order';
import { privateResponse, errorResponse } from '@/utils/api-response';

export const GET = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const order = await getOrderById(numId, user.id);
    if (!order) {
      return errorResponse('Замовлення не знайдено', 404);
    }
    return privateResponse(order);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
