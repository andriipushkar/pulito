import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { generateInvoicePdf, PdfError } from '@/services/pdf';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin', 'manager')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const orderId = Number(id);

      if (!orderId || isNaN(orderId)) {
        return errorResponse('Невалідний ID замовлення', 400);
      }

      const invoicePdfUrl = await generateInvoicePdf(orderId);

      return successResponse({ invoicePdfUrl }, 201);
    } catch (error) {
      if (error instanceof PdfError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/orders/[id]/invoice] POST failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
