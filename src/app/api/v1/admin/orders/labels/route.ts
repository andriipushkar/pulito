import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import PDFDocument from 'pdfkit';
import { logger } from '@/lib/logger';

// Stored-XSS guard for HTML labels: every field that originates with the
// customer (name, phone, address, comment, product name) flows into HTML
// markup, so anything that isn't escaped becomes a click-to-execute payload
// in the admin's browser. Mirror the rules React uses by default.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { orderIds, format } = body as { orderIds?: unknown; format?: 'html' | 'pdf' };

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return errorResponse("orderIds обов'язковий (масив ID)", 400);
    }

    // Filter out non-integer IDs *before* hitting Prisma — `Number('abc')`
    // returns NaN which Prisma silently accepts and produces undefined results.
    // Also exclude soft-deleted orders so labels never print for a discarded record.
    const numericIds = orderIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
    if (numericIds.length === 0) {
      return errorResponse('Жоден ID не пройшов валідацію', 400);
    }
    const orders = await prisma.order.findMany({
      where: { id: { in: numericIds }, deletedAt: null },
      include: {
        items: {
          include: { product: { select: { name: true, code: true } } },
        },
      },
    });

    const reportsDir = path.join(env.UPLOAD_DIR, 'reports');
    if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
    const stamp = Date.now();

    if (format === 'pdf') {
      // PDFKit doesn't ship with a UTF-8 font by default — we need a font
      // bundled with the project for Cyrillic. We fall back to Helvetica
      // (Latin-only) when the project font isn't found, which still produces
      // a valid file even if Cyrillic shows as boxes.
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf');
      const hasFont = existsSync(fontPath);
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      if (hasFont) doc.font(fontPath);

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      const done = new Promise<Buffer>((resolve) =>
        doc.on('end', () => resolve(Buffer.concat(chunks))),
      );

      orders.forEach((o, idx) => {
        if (idx > 0) doc.addPage();
        doc.fontSize(18).text(`Замовлення #${o.orderNumber}`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Отримувач: ${o.contactName}`);
        doc.text(`Телефон: ${o.contactPhone}`);
        if (o.deliveryCity) doc.text(`Місто: ${o.deliveryCity}`);
        if (o.deliveryAddress) doc.text(`Адреса: ${o.deliveryAddress}`);
        doc.text(`Доставка: ${o.deliveryMethod}`);
        if (o.trackingNumber) doc.text(`ТТН: ${o.trackingNumber}`);
        doc.text(`Сума: ${Number(o.totalAmount).toFixed(2)} грн`);
        doc.moveDown(0.3);
        doc
          .fontSize(9)
          .text(o.items.map((i) => `${i.product?.name || ''} x${i.quantity}`).join(', '));
      });
      doc.end();
      const pdfBuffer = await done;
      const fileName = `labels_${stamp}.pdf`;
      writeFileSync(path.join(reportsDir, fileName), pdfBuffer);
      return successResponse({ url: `/uploads/reports/${fileName}` });
    }

    // Default: HTML, print-ready
    const labelsHtml = orders
      .map(
        (o) => `
        <div style="page-break-after: always; border: 2px solid #000; padding: 20px; margin: 10px; font-family: Arial, sans-serif;">
          <h2 style="margin: 0 0 10px;">Замовлення #${escapeHtml(o.orderNumber)}</h2>
          <p><strong>Отримувач:</strong> ${escapeHtml(o.contactName)}</p>
          <p><strong>Телефон:</strong> ${escapeHtml(o.contactPhone)}</p>
          <p><strong>Місто:</strong> ${escapeHtml(o.deliveryCity || '—')}</p>
          <p><strong>Адреса:</strong> ${escapeHtml(o.deliveryAddress || '—')}</p>
          <p><strong>Доставка:</strong> ${escapeHtml(o.deliveryMethod)}</p>
          ${o.trackingNumber ? `<p><strong>ТТН:</strong> ${escapeHtml(o.trackingNumber)}</p>` : ''}
          <p><strong>Сума:</strong> ${Number(o.totalAmount).toFixed(2)} грн</p>
          <hr/>
          <p style="font-size: 12px;">${o.items
            .map((i) => `${escapeHtml(i.product?.name ?? '')} x${i.quantity}`)
            .join(', ')}</p>
        </div>
      `,
      )
      .join('');
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Етикетки</title><script>window.onload=()=>window.print()</script></head><body>${labelsHtml}</body></html>`;
    const fileName = `labels_${stamp}.html`;
    writeFileSync(path.join(reportsDir, fileName), fullHtml);
    return successResponse({ url: `/uploads/reports/${fileName}` });
  } catch (err) {
    logger.error('[admin/orders/labels] POST failed', { error: err });
    return errorResponse('Помилка генерації етикеток', 500);
  }
});
