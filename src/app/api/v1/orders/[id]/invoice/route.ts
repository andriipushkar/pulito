import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { generateInvoicePdf, PdfError } from '@/services/pdf';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    // PDF generation hits Chromium + DB join; cap per user/day same as the
    // commercial-proposal flow (50/day adminPdfExport bucket).
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPdfExport);
    if (!rl.allowed) return errorResponse('Денний ліміт invoice PDF вичерпано', 429);

    const { id } = await params!;
    const orderId = Number(id);
    // `Number('-5') = -5`, `!(-5) = false`, `isNaN(-5) = false` — negatives
    // slipped through. Require finite positive integer to match the FK type.
    if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isInteger(orderId)) {
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
