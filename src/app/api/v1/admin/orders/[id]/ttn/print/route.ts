import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { fetchPrintPdf, NovaPoshtaError, type PrintType } from '@/services/nova-poshta';
import { errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const VALID_TYPES: PrintType[] = ['document', 'marking', 'marking100x100'];

// Stream a printable PDF for a single order's TTN.
//   ?type=document        → full A4 express waybill (default)
//   ?type=marking         → sticker label
//   ?type=marking100x100  → 100×100 thermal sticker (Zebra)
export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return errorResponse('Невалідний ID замовлення', 400);
    }

    const typeParam = (request.nextUrl.searchParams.get('type') || 'document') as PrintType;
    const type: PrintType = VALID_TYPES.includes(typeParam) ? typeParam : 'document';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { trackingNumber: true, orderNumber: true },
    });
    if (!order?.trackingNumber || order.trackingNumber.startsWith('PENDING_')) {
      return errorResponse('У замовлення немає ТТН для друку', 400);
    }

    const pdf = await fetchPrintPdf([order.trackingNumber], type);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ttn-${order.orderNumber}-${type}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/[id]/ttn/print] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
