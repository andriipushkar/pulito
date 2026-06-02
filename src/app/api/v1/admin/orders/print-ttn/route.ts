import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { fetchPrintPdf, NovaPoshtaError, type PrintType } from '@/services/nova-poshta';
import { errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const schema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1, 'Оберіть хоча б одне замовлення').max(100),
  type: z.enum(['document', 'marking', 'marking100x100']).default('document'),
});

// Bulk-print TTNs for several orders into a single combined PDF — one click
// to print all stickers/waybills for the day's shipments.
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const { orderIds, type } = parsed.data;

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { trackingNumber: true },
    });
    const numbers = orders
      .map((o) => o.trackingNumber)
      .filter((n): n is string => !!n && !n.startsWith('PENDING_'));

    if (numbers.length === 0) {
      return errorResponse('Серед обраних замовлень немає жодного з ТТН', 400);
    }

    const pdf = await fetchPrintPdf(numbers, type as PrintType);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ttn-bulk-${type}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/orders/print-ttn] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
