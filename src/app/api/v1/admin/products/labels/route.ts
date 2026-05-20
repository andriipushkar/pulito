import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js/node';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { isValidGtin } from '@/utils/gtin';

/**
 * POST /api/v1/admin/products/labels
 *
 * Body: { productIds: number[], copiesEach?: number }
 *
 * Returns a PDF (Avery L7160-style 3×8 grid, 24 labels/sheet) ready to print
 * on standard A4 label paper. Each label shows: barcode (EAN-13), name, code,
 * price. Products without a barcode are skipped silently; the response header
 * `X-Skipped` reports how many were dropped so the UI can warn the operator.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as { productIds?: unknown; copiesEach?: unknown };
    const ids = Array.isArray(body.productIds)
      ? body.productIds.filter((v): v is number => typeof v === 'number')
      : [];
    const copies = Math.max(1, Math.min(100, Number(body.copiesEach) || 1));

    if (ids.length === 0) return errorResponse('Не вибрано жодного товару', 400);

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true, code: true, barcode: true, priceRetail: true },
    });

    const printable = products.filter((p) => p.barcode && isValidGtin(p.barcode));
    const skipped = products.length - printable.length;

    if (printable.length === 0) {
      return errorResponse('Жоден з обраних товарів не має валідного штрихкоду', 400);
    }

    // Expand by copies
    const queue: typeof printable = [];
    for (const p of printable) {
      for (let i = 0; i < copies; i++) queue.push(p);
    }

    // Pre-render barcode PNGs in parallel (bwip-js is CPU-bound but fast).
    const barcodeImages = await Promise.all(
      queue.map((p) =>
        bwipjs.toBuffer({
          bcid: 'ean13',
          text: p.barcode!,
          scale: 2,
          height: 10,
          includetext: true,
          textxalign: 'center',
          textsize: 8,
        }),
      ),
    );

    const pdfBuffer = await renderLabelSheet(queue, barcodeImages);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="labels_${Date.now()}.pdf"`,
        'X-Skipped': String(skipped),
        'X-Printed': String(queue.length),
      },
    });
  } catch (err) {
    logger.error('[products/labels] POST failed', { error: err });
    return errorResponse('Помилка генерації етикеток', 500);
  }
});

interface LabelProduct {
  name: string;
  code: string;
  barcode: string | null;
  priceRetail: { toString(): string } | string | number;
}

async function renderLabelSheet(
  items: LabelProduct[],
  barcodes: Buffer[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Avery L7160: 3 cols × 8 rows. A4 = 595.28 × 841.89 pt.
    // Top margin 15mm = 42.5pt, side margin 4.5mm = 12.7pt, gap 2.5mm = 7pt.
    const COLS = 3;
    const ROWS = 8;
    const PAGE_W = 595.28;
    const MARGIN_TOP = 42;
    const MARGIN_SIDE = 13;
    const GAP_X = 7;
    const GAP_Y = 0;
    const LABEL_W = (PAGE_W - MARGIN_SIDE * 2 - GAP_X * (COLS - 1)) / COLS; // ~186pt
    const LABEL_H = 99; // ~35mm
    const PADDING = 4;

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    items.forEach((item, idx) => {
      const onPage = idx % (COLS * ROWS);
      if (idx > 0 && onPage === 0) doc.addPage({ size: 'A4', margin: 0 });

      const col = onPage % COLS;
      const row = Math.floor(onPage / COLS);
      const x = MARGIN_SIDE + col * (LABEL_W + GAP_X);
      const y = MARGIN_TOP + row * (LABEL_H + GAP_Y);

      // Subtle dashed border so the operator can see label boundaries when
      // printing on plain paper for a test run.
      doc
        .save()
        .lineWidth(0.3)
        .dash(2, { space: 2 })
        .strokeColor('#cccccc')
        .rect(x, y, LABEL_W, LABEL_H)
        .stroke()
        .restore();

      // Product name (top, max 2 lines)
      doc
        .fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(item.name, x + PADDING, y + PADDING, {
          width: LABEL_W - PADDING * 2,
          height: 22,
          ellipsis: true,
        });

      // Barcode image (centred horizontally)
      const barcodeW = LABEL_W - PADDING * 4;
      const barcodeX = x + (LABEL_W - barcodeW) / 2;
      const barcodeY = y + 26;
      doc.image(barcodes[idx], barcodeX, barcodeY, {
        width: barcodeW,
        height: 50,
      });

      // Code + price (bottom row)
      const bottomY = y + LABEL_H - 12;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#444444')
        .text(`Код: ${item.code}`, x + PADDING, bottomY, {
          width: LABEL_W / 2 - PADDING,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#111111')
        .text(`${Number(item.priceRetail).toFixed(2)} ₴`, x + LABEL_W / 2, bottomY, {
          width: LABEL_W / 2 - PADDING,
          align: 'right',
        });
    });

    doc.end();
  });
}
