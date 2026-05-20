import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js/node';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';

/**
 * Generate a printable PDF sheet with barcodes/QR for a set of products.
 *
 * Layout: A4, 3 columns × N rows. Each cell shows product name, code, and the
 * encoded symbol. Defaults to Code128 (encodes any printable ASCII so works
 * with arbitrary SKU strings). EAN-13 is auto-selected if the code is exactly
 * 12 or 13 digits.
 */

type SymbolKind = 'code128' | 'ean13' | 'qr';

interface PrintItem {
  id: number;
  name: string;
  code: string;
  symbol: SymbolKind;
  payload: string;
}

function chooseSymbol(code: string, preferred?: SymbolKind): SymbolKind {
  if (preferred) return preferred;
  if (/^\d{12,13}$/.test(code)) return 'ean13';
  return 'code128';
}

async function renderSymbol(item: PrintItem): Promise<Buffer> {
  if (item.symbol === 'qr') {
    return QRCode.toBuffer(item.payload, {
      type: 'png',
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }
  return bwipjs.toBuffer({
    bcid: item.symbol,
    text: item.payload,
    scale: 3,
    height: item.symbol === 'ean13' ? 18 : 12,
    includetext: true,
    textxalign: 'center',
    backgroundcolor: 'FFFFFF',
  });
}

export async function generateBarcodePdf(
  productIds: number[],
  symbolPreference?: SymbolKind,
): Promise<Buffer> {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, code: true },
  });

  const items: PrintItem[] = products.map((p) => {
    const symbol = chooseSymbol(p.code, symbolPreference);
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      symbol,
      payload: p.code,
    };
  });

  const doc = new PDFDocument({ size: 'A4', margin: 24 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const cols = 3;
  const cellWidth = (595 - 48) / cols; // A4 width 595pt minus margins
  const cellHeight = 140;
  let col = 0;
  let y = 36;

  for (const item of items) {
    const buf = await renderSymbol(item);
    const x = 24 + col * cellWidth;

    doc
      .roundedRect(x, y, cellWidth - 8, cellHeight - 8, 4)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();

    doc
      .image(buf, x + 12, y + 10, {
        fit: [cellWidth - 32, cellHeight - 70],
        align: 'center',
      });

    doc
      .fontSize(9)
      .fillColor('#000')
      .text(item.name, x + 8, y + cellHeight - 50, {
        width: cellWidth - 16,
        height: 24,
        ellipsis: true,
        align: 'center',
      });
    doc
      .fontSize(8)
      .fillColor('#666')
      .text(item.code, x + 8, y + cellHeight - 22, {
        width: cellWidth - 16,
        align: 'center',
      });

    col += 1;
    if (col >= cols) {
      col = 0;
      y += cellHeight;
      if (y + cellHeight > 800) {
        doc.addPage();
        y = 36;
      }
    }
  }

  doc.end();
  return done;
}
