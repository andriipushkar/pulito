import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { reorderFromOrder, ReorderError } from '@/services/reorder';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { orderId } = await params!;
    const id = Number(orderId);

    if (isNaN(id)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    const result = await reorderFromOrder(id, user.id);

    return successResponse(result);
  } catch (error) {
    if (error instanceof ReorderError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка повторного замовлення', 500);
  }
});
