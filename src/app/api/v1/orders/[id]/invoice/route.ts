import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { generateInvoicePdf, PdfError } from '@/services/pdf';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    // Verify user owns this order
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== user.id) {
      return errorResponse('Замовлення не знайдено', 404);
    }

    const url = await generateInvoicePdf(orderId);
    return successResponse({ url }, 201);
  } catch (error) {
    if (error instanceof PdfError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
