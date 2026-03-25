import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { refundPayment, PaymentError } from '@/services/payment';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);
    if (!orderId) return errorResponse('Невірний ID замовлення', 400);

    const body = await request.json().catch(() => ({}));
    const amount = body.amount ? Number(body.amount) : undefined;

    if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
      return errorResponse('Невірна сума повернення', 400);
    }

    const result = await refundPayment(orderId, amount);

    if (!result.success) {
      return errorResponse(result.message || 'Не вдалося виконати повернення', 400);
    }

    return successResponse(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка сервера', 500);
  }
});
