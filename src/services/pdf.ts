import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import {
  BRAND,
  PAGE,
  setupDoc,
  getCompanyInfo,
  drawHeader,
  drawDocTitle,
  drawSectionTitle,
  drawInfoLine,
  drawTableHeader,
  drawTableRow,
  drawFooter,
} from '@/lib/pdf-theme';

export class PdfError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

/**
 * Генерує PDF рахунку-фактури для замовлення.
 */
export async function generateInvoicePdf(orderId: number): Promise<string> {
  const COMPANY = await getCompanyInfo();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payment: true,
    },
  });

  if (!order) {
    throw new PdfError('Замовлення не знайдено', 404);
  }

  const invoicesDir = path.join(env.UPLOAD_DIR, 'invoices');
  if (!existsSync(invoicesDir)) {
    mkdirSync(invoicesDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `invoice_${order.orderNumber}_${timestamp}.pdf`;
  const filePath = path.join(invoicesDir, fileName);
  const publicUrl = `/uploads/invoices/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin });
  setupDoc(doc);

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc, COMPANY);

  // Title
  drawDocTitle(
    doc,
    'Рахунок-фактура',
    `#${order.orderNumber}`,
    order.createdAt.toLocaleDateString('uk-UA')
  );

  // Client info
  drawSectionTitle(doc, 'Інформація про клієнта');
  drawInfoLine(doc, "Ім'я:", order.contactName);
  drawInfoLine(doc, 'Телефон:', order.contactPhone);
  if (order.contactEmail) drawInfoLine(doc, 'Email:', order.contactEmail);
  if (order.deliveryCity) drawInfoLine(doc, 'Місто:', order.deliveryCity);
  if (order.deliveryAddress) drawInfoLine(doc, 'Адреса:', order.deliveryAddress);
  doc.moveDown(1);

  // Items table — columns span full content width (515)
  const M = PAGE.margin;
  const colDefs = [
    { label: 'Код', x: M, width: 70 },
    { label: 'Назва товару', x: M + 75, width: 245 },
    { label: 'Ціна', x: M + 325, width: 65, align: 'right' as const },
    { label: 'К-ть', x: M + 395, width: 45, align: 'center' as const },
    { label: 'Сума', x: M + 445, width: 70, align: 'right' as const },
  ];

  drawTableHeader(doc, colDefs);

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];

    if (doc.y > 720) {
      drawFooter(doc, COMPANY);
      doc.addPage();
      drawHeader(doc, COMPANY);
      drawTableHeader(doc, colDefs);
    }

    drawTableRow(doc, [
      { value: item.productCode || '-', x: colDefs[0].x, width: colDefs[0].width },
      { value: item.productName, x: colDefs[1].x, width: colDefs[1].width },
      { value: `${Number(item.priceAtOrder).toFixed(2)}`, x: colDefs[2].x, width: colDefs[2].width, align: 'right' },
      { value: String(item.quantity), x: colDefs[3].x, width: colDefs[3].width, align: 'center' },
      { value: `${Number(item.subtotal).toFixed(2)}`, x: colDefs[4].x, width: colDefs[4].width, align: 'right' },
    ], i);
  }

  doc.moveDown(0.5);

  // Bottom line under table
  doc.moveTo(PAGE.margin, doc.y).lineTo(PAGE.margin + PAGE.contentWidth, doc.y).lineWidth(0.5).stroke(BRAND.border);
  doc.moveDown(0.5);

  // Totals block — right-aligned
  const totalsX = PAGE.margin + 300;
  const totalsW = 195;

  const subtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);
  doc.text(`Сума товарів:`, totalsX, doc.y, { width: totalsW - 80 });
  doc.font('Regular').fontSize(9).fillColor(BRAND.text);
  doc.text(`${subtotal.toFixed(2)} грн`, totalsX + totalsW - 80, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });

  if (Number(order.discountAmount) > 0) {
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);
    doc.text(`Знижка:`, totalsX, doc.y, { width: totalsW - 80 });
    doc.font('Regular').fontSize(9).fillColor('#F44336');
    doc.text(`-${Number(order.discountAmount).toFixed(2)} грн`, totalsX + totalsW - 80, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  }

  if (Number(order.deliveryCost) > 0) {
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);
    doc.text(`Доставка:`, totalsX, doc.y, { width: totalsW - 80 });
    doc.font('Regular').fontSize(9).fillColor(BRAND.text);
    doc.text(`${Number(order.deliveryCost).toFixed(2)} грн`, totalsX + totalsW - 80, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  }

  doc.moveDown(0.5);

  // Total amount with background
  const totalY = doc.y;
  doc.rect(totalsX - 5, totalY - 4, totalsW + 10, 22).fill(BRAND.primary);
  doc.font('Bold').fontSize(11).fillColor(BRAND.white);
  doc.text(`Всього: ${Number(order.totalAmount).toFixed(2)} грн`, totalsX, totalY, {
    width: totalsW,
    align: 'right',
  });

  // Footer
  drawFooter(doc, COMPANY);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Update payment record with invoice URL
  if (order.payment) {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { invoicePdfUrl: publicUrl },
    });
  }

  return publicUrl;
}

/**
 * Генерує видаткову накладну PDF для замовлення.
 */
export async function generateDeliveryNotePdf(orderId: number): Promise<string> {
  const COMPANY = await getCompanyInfo();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new PdfError('Замовлення не знайдено', 404);
  }

  const notesDir = path.join(env.UPLOAD_DIR, 'delivery-notes');
  if (!existsSync(notesDir)) {
    mkdirSync(notesDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `delivery_note_${order.orderNumber}_${timestamp}.pdf`;
  const filePath = path.join(notesDir, fileName);
  const publicUrl = `/uploads/delivery-notes/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin });
  setupDoc(doc);

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc, COMPANY);

  // Title
  drawDocTitle(
    doc,
    'Видаткова накладна',
    `#${order.orderNumber}`,
    order.createdAt.toLocaleDateString('uk-UA')
  );

  // Two-column layout for Supplier and Client
  const leftCol = PAGE.margin;
  const rightCol = PAGE.margin + 250;

  // Supplier
  drawSectionTitle(doc, 'Постачальник');
  const supplierStartY = doc.y;
  doc.font('Regular').fontSize(9).fillColor(BRAND.text);
  doc.text(`${COMPANY.name} — ${COMPANY.description}`, leftCol, doc.y, { width: 230 });
  doc.text(`Сайт: ${COMPANY.website}`, leftCol);

  // Client (same Y position)
  doc.font('Bold').fontSize(10).fillColor(BRAND.primaryDark);
  doc.text('Отримувач', rightCol, supplierStartY, { width: 230 });
  doc.moveDown(0.3);
  doc.font('Regular').fontSize(9).fillColor(BRAND.text);
  doc.text(`${order.contactName}`, rightCol, doc.y, { width: 230 });
  doc.text(`Тел: ${order.contactPhone}`, rightCol, doc.y, { width: 230 });
  if (order.contactEmail) doc.text(`Email: ${order.contactEmail}`, rightCol, doc.y, { width: 230 });
  if (order.deliveryCity) doc.text(`Місто: ${order.deliveryCity}`, rightCol, doc.y, { width: 230 });
  if (order.deliveryAddress) doc.text(`Адреса: ${order.deliveryAddress}`, rightCol, doc.y, { width: 230 });
  if (order.trackingNumber) {
    doc.font('Bold').fontSize(9).fillColor(BRAND.accent);
    doc.text(`ТТН: ${order.trackingNumber}`, rightCol, doc.y, { width: 230 });
  }

  doc.moveDown(1);

  // Items table — 7 columns spanning full 515px width
  const colDefs = [
    { label: '№', x: PAGE.margin, width: 25, align: 'center' as const },
    { label: 'Код', x: PAGE.margin + 28, width: 65 },
    { label: 'Назва товару', x: PAGE.margin + 98, width: 210 },
    { label: 'Од.', x: PAGE.margin + 313, width: 30, align: 'center' as const },
    { label: 'К-ть', x: PAGE.margin + 348, width: 40, align: 'center' as const },
    { label: 'Ціна', x: PAGE.margin + 393, width: 55, align: 'right' as const },
    { label: 'Сума', x: PAGE.margin + 453, width: 62, align: 'right' as const },
  ];

  drawTableHeader(doc, colDefs);

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];

    if (doc.y > 700) {
      drawFooter(doc, COMPANY);
      doc.addPage();
      drawHeader(doc, COMPANY);
      drawTableHeader(doc, colDefs);
    }

    drawTableRow(doc, [
      { value: String(i + 1), x: colDefs[0].x, width: colDefs[0].width, align: 'center' },
      { value: item.productCode || '-', x: colDefs[1].x, width: colDefs[1].width },
      { value: item.productName, x: colDefs[2].x, width: colDefs[2].width },
      { value: 'шт.', x: colDefs[3].x, width: colDefs[3].width, align: 'center' },
      { value: String(item.quantity), x: colDefs[4].x, width: colDefs[4].width, align: 'center' },
      { value: `${Number(item.priceAtOrder).toFixed(2)}`, x: colDefs[5].x, width: colDefs[5].width, align: 'right' },
      { value: `${Number(item.subtotal).toFixed(2)}`, x: colDefs[6].x, width: colDefs[6].width, align: 'right' },
    ], i);
  }

  doc.moveDown(0.5);
  doc.moveTo(PAGE.margin, doc.y).lineTo(PAGE.margin + PAGE.contentWidth, doc.y).lineWidth(0.5).stroke(BRAND.border);
  doc.moveDown(0.5);

  // Total with styled block
  const totalY = doc.y;
  const totalsX = PAGE.margin + 300;
  const totalsW = 195;
  doc.rect(totalsX - 5, totalY - 4, totalsW + 10, 22).fill(BRAND.primary);
  doc.font('Bold').fontSize(11).fillColor(BRAND.white);
  doc.text(`Всього: ${Number(order.totalAmount).toFixed(2)} грн`, totalsX, totalY, {
    width: totalsW,
    align: 'right',
  });

  // Signatures section
  doc.y = totalY + 50;
  doc.moveTo(PAGE.margin, doc.y).lineTo(PAGE.margin + PAGE.contentWidth, doc.y).lineWidth(0.5).stroke(BRAND.border);
  doc.moveDown(1);

  doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);

  const sigY = doc.y;
  // Left signature
  doc.text('Відпустив:', PAGE.margin, sigY);
  doc.moveTo(PAGE.margin + 60, sigY + 12).lineTo(PAGE.margin + 200, sigY + 12).lineWidth(0.5).stroke(BRAND.border);

  // Right signature
  doc.text('Отримав:', rightCol, sigY);
  doc.moveTo(rightCol + 55, sigY + 12).lineTo(rightCol + 200, sigY + 12).lineWidth(0.5).stroke(BRAND.border);

  // Footer
  drawFooter(doc, COMPANY);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}

/**
 * Генерує комерційну пропозицію PDF для вибраних товарів.
 */
export async function generateCommercialOfferPdf(
  products: {
    code: string;
    name: string;
    price: number;
    unit?: string;
    description?: string;
  }[],
  clientName?: string
): Promise<string> {
  if (products.length === 0) {
    throw new PdfError('Список товарів порожній', 400);
  }

  const COMPANY = await getCompanyInfo();
  const offersDir = path.join(env.UPLOAD_DIR, 'offers');
  if (!existsSync(offersDir)) {
    mkdirSync(offersDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `offer_${timestamp}.pdf`;
  const filePath = path.join(offersDir, fileName);
  const publicUrl = `/uploads/offers/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin });
  setupDoc(doc);

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc, COMPANY);

  // Title
  drawDocTitle(
    doc,
    'Комерційна пропозиція',
    clientName ? `Для: ${clientName}` : '',
    new Date().toLocaleDateString('uk-UA')
  );

  doc.font('Regular').fontSize(9).fillColor(BRAND.text);
  doc.text('Шановний клієнте, пропонуємо Вам наступні товари:');
  doc.moveDown(0.8);

  // Items table — 5 columns spanning full 515px width
  const colDefs = [
    { label: '№', x: PAGE.margin, width: 25, align: 'center' as const },
    { label: 'Код', x: PAGE.margin + 30, width: 75 },
    { label: 'Назва товару', x: PAGE.margin + 110, width: 250 },
    { label: 'Ціна', x: PAGE.margin + 365, width: 80, align: 'right' as const },
    { label: 'Од.', x: PAGE.margin + 450, width: 65, align: 'center' as const },
  ];

  drawTableHeader(doc, colDefs);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    if (doc.y > 720) {
      drawFooter(doc, COMPANY);
      doc.addPage();
      drawHeader(doc, COMPANY);
      drawTableHeader(doc, colDefs);
    }

    drawTableRow(doc, [
      { value: String(i + 1), x: colDefs[0].x, width: colDefs[0].width, align: 'center' },
      { value: p.code, x: colDefs[1].x, width: colDefs[1].width },
      { value: p.name, x: colDefs[2].x, width: colDefs[2].width },
      { value: `${p.price.toFixed(2)} грн`, x: colDefs[3].x, width: colDefs[3].width, align: 'right' },
      { value: p.unit || 'шт.', x: colDefs[4].x, width: colDefs[4].width, align: 'center' },
    ], i);
  }

  doc.moveDown(0.5);
  doc.moveTo(PAGE.margin, doc.y).lineTo(PAGE.margin + PAGE.contentWidth, doc.y).lineWidth(0.5).stroke(BRAND.border);
  doc.moveDown(1);

  doc.font('Regular').fontSize(8).fillColor(BRAND.textSecondary);
  doc.text('Ціни вказані з ПДВ. Пропозиція дійсна протягом 14 днів.');
  doc.moveDown(0.3);
  doc.text(`Контакти: ${COMPANY.website}`);

  // Footer
  drawFooter(doc, COMPANY);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
