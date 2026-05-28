import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { initiatePayment, PaymentError } from '@/services/payment';
import { initiatePaymentSchema } from '@/validators/payment';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const orderId = parseInt(id, 10);
    // `isNaN(-5) === false` — guard with positive-integer check.
    if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isInteger(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }

    // Verify the authenticated user owns this order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order || order.userId !== user.id) {
      return errorResponse('Замовлення не знайдено', 404);
    }

    const body = await request.json();
    const parsed = initiatePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const result = await initiatePayment(orderId, parsed.data.provider);
    return successResponse(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
