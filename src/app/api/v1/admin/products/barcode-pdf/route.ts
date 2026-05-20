import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/auth';
import { generateBarcodePdf } from '@/services/barcode-pdf';
import { errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const ids = Array.isArray(body.productIds)
      ? body.productIds.filter((n: unknown) => Number.isInteger(n) && Number(n) > 0).slice(0, 200)
      : [];
    if (ids.length === 0) return errorResponse('Передайте productIds', 400);

    const symbol = body.symbol as 'code128' | 'ean13' | 'qr' | undefined;
    const pdf = await generateBarcodePdf(ids, symbol);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="barcodes-${Date.now()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    logger.error('[admin/products/barcode-pdf] POST failed', { error: err });
    return errorResponse(`Помилка генерації PDF: ${String(err)}`, 500);
  }
});
