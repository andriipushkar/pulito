import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';

export class PdfError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

const FONT_REGULAR = path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf');
const FONT_BOLD = path.join(process.cwd(), 'src/assets/fonts/Roboto-Bold.ttf');

// Brand colors matching the site
const COLORS = {
  primary: '#1E88E5',
  primaryDark: '#1565C0',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  bgLight: '#F5F5F5',
  white: '#FFFFFF',
  success: '#4CAF50',
  accent: '#FF9800',
};

const COMPANY = {
  name: 'Порошок',
  description: 'Інтернет-магазин побутової хімії',
  website: 'poroshok.ua',
  phone: '+380 (XX) XXX-XX-XX',
};

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495; // A4 width - 2*margin

function setupDoc(doc: InstanceType<typeof PDFDocument>) {
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold', FONT_BOLD);
}

function drawHeader(doc: InstanceType<typeof PDFDocument>) {
  // Blue header bar
  doc.rect(0, 0, 595.28, 80).fill(COLORS.primary);

  // Company name
  doc.font('Bold').fontSize(22).fillColor(COLORS.white);
  doc.text(COMPANY.name, PAGE_MARGIN, 20, { width: CONTENT_WIDTH, align: 'left' });

  // Description
  doc.font('Regular').fontSize(9).fillColor(COLORS.white);
  doc.text(COMPANY.description, PAGE_MARGIN, 46, { width: CONTENT_WIDTH, align: 'left' });
  doc.text(COMPANY.website, PAGE_MARGIN, 58, { width: CONTENT_WIDTH, align: 'left' });

  doc.y = 100;
}

function drawDocTitle(doc: InstanceType<typeof PDFDocument>, title: string, orderNumber: string, date: string) {
  doc.font('Bold').fontSize(14).fillColor(COLORS.primaryDark);
  doc.text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'left' });
  doc.moveDown(0.3);

  doc.font('Regular').fontSize(10).fillColor(COLORS.textSecondary);
  doc.text(`${orderNumber}  |  ${date}`, { width: CONTENT_WIDTH, align: 'left' });
  doc.moveDown(0.8);

  // Divider line
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y).lineWidth(1).stroke(COLORS.primary);
  doc.moveDown(0.8);
}

function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.font('Bold').fontSize(10).fillColor(COLORS.primaryDark);
  doc.text(title);
  doc.moveDown(0.3);
}

function drawInfoLine(doc: InstanceType<typeof PDFDocument>, label: string, value: string) {
  const y = doc.y;
  doc.font('Bold').fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(label, PAGE_MARGIN, y, { continued: true });
  doc.font('Regular').fontSize(9).fillColor(COLORS.text);
  doc.text(` ${value}`);
}

function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  columns: { label: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[]
) {
  const y = doc.y;

  // Header background
  doc.rect(PAGE_MARGIN, y - 3, CONTENT_WIDTH, 18).fill(COLORS.primaryDark);

  doc.font('Bold').fontSize(8).fillColor(COLORS.white);
  for (const col of columns) {
    doc.text(col.label, col.x, y, { width: col.width, align: col.align || 'left' });
  }

  doc.y = y + 20;
  doc.fillColor(COLORS.text);
}

function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  columns: { value: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[],
  rowIndex: number
) {
  const y = doc.y;

  // Alternating row background
  if (rowIndex % 2 === 0) {
    doc.rect(PAGE_MARGIN, y - 2, CONTENT_WIDTH, 18).fill(COLORS.bgLight);
  }

  doc.font('Regular').fontSize(8).fillColor(COLORS.text);
  for (const col of columns) {
    doc.text(col.value, col.x, y, { width: col.width, align: col.align || 'left' });
  }

  doc.y = y + 18;
}

function drawFooter(doc: InstanceType<typeof PDFDocument>) {
  const bottomY = 780;

  // Footer line
  doc.moveTo(PAGE_MARGIN, bottomY).lineTo(PAGE_MARGIN + CONTENT_WIDTH, bottomY).lineWidth(0.5).stroke(COLORS.border);

  doc.font('Regular').fontSize(7).fillColor(COLORS.textSecondary);
  doc.text(
    `${COMPANY.name} — ${COMPANY.description}  |  ${COMPANY.website}`,
    PAGE_MARGIN,
    bottomY + 6,
    { width: CONTENT_WIDTH, align: 'center' }
  );
}

/**
 * Генерує PDF рахунку-фактури для замовлення.
 */
export async function generateInvoicePdf(orderId: number): Promise<string> {
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

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  setupDoc(doc);

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc);

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

  // Items table
  const colDefs = [
    { label: 'Код', x: PAGE_MARGIN + 5, width: 80 },
    { label: 'Назва товару', x: PAGE_MARGIN + 90, width: 200 },
    { label: 'Ціна', x: PAGE_MARGIN + 295, width: 65, align: 'right' as const },
    { label: 'К-ть', x: PAGE_MARGIN + 365, width: 40, align: 'center' as const },
    { label: 'Сума', x: PAGE_MARGIN + 410, width: 80, align: 'right' as const },
  ];

  drawTableHeader(doc, colDefs);

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];

    if (doc.y > 720) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc);
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
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y).lineWidth(0.5).stroke(COLORS.border);
  doc.moveDown(0.5);

  // Totals block — right-aligned
  const totalsX = PAGE_MARGIN + 300;
  const totalsW = 195;

  const subtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  doc.font('Regular').fontSize(9).fillColor(COLORS.textSecondary);
  doc.text(`Сума товарів:`, totalsX, doc.y, { width: totalsW - 80 });
  doc.font('Regular').fontSize(9).fillColor(COLORS.text);
  doc.text(`${subtotal.toFixed(2)} грн`, totalsX + totalsW - 80, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });

  if (Number(order.discountAmount) > 0) {
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(9).fillColor(COLORS.textSecondary);
    doc.text(`Знижка:`, totalsX, doc.y, { width: totalsW - 80 });
    doc.font('Regular').fontSize(9).fillColor('#F44336');
    doc.text(`-${Number(order.discountAmount).toFixed(2)} грн`, totalsX + totalsW - 80, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  }

  if (Number(order.deliveryCost) > 0) {
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(9).fillColor(COLORS.textSecondary);
    doc.text(`Доставка:`, totalsX, doc.y, { width: totalsW - 80 });
    doc.font('Regular').fontSize(9).fillColor(COLORS.text);
    doc.text(`${Number(order.deliveryCost).toFixed(2)} грн`, totalsX + totalsW - 80, doc.y - doc.currentLineHeight(), { width: 80, align: 'right' });
  }

  doc.moveDown(0.5);

  // Total amount with background
  const totalY = doc.y;
  doc.rect(totalsX - 5, totalY - 4, totalsW + 10, 22).fill(COLORS.primary);
  doc.font('Bold').fontSize(11).fillColor(COLORS.white);
  doc.text(`Всього: ${Number(order.totalAmount).toFixed(2)} грн`, totalsX, totalY, {
    width: totalsW,
    align: 'right',
  });

  // Footer
  drawFooter(doc);

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

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  setupDoc(doc);

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc);

  // Title
  drawDocTitle(
    doc,
    'Видаткова накладна',
    `#${order.orderNumber}`,
    order.createdAt.toLocaleDateString('uk-UA')
  );

  // Two-column layout for Supplier and Client
  const leftCol = PAGE_MARGIN;
  const rightCol = PAGE_MARGIN + 250;

  // Supplier
  drawSectionTitle(doc, 'Постачальник');
  const supplierStartY = doc.y;
  doc.font('Regular').fontSize(9).fillColor(COLORS.text);
  doc.text(`${COMPANY.name} — ${COMPANY.description}`, leftCol, doc.y, { width: 230 });
  doc.text(`Сайт: ${COMPANY.website}`, leftCol);

  // Client (same Y position)
  doc.font('Bold').fontSize(10).fillColor(COLORS.primaryDark);
  doc.text('Отримувач', rightCol, supplierStartY, { width: 230 });
  doc.moveDown(0.3);
  doc.font('Regular').fontSize(9).fillColor(COLORS.text);
  doc.text(`${order.contactName}`, rightCol, doc.y, { width: 230 });
  doc.text(`Тел: ${order.contactPhone}`, rightCol, doc.y, { width: 230 });
  if (order.contactEmail) doc.text(`Email: ${order.contactEmail}`, rightCol, doc.y, { width: 230 });
  if (order.deliveryCity) doc.text(`Місто: ${order.deliveryCity}`, rightCol, doc.y, { width: 230 });
  if (order.deliveryAddress) doc.text(`Адреса: ${order.deliveryAddress}`, rightCol, doc.y, { width: 230 });
  if (order.trackingNumber) {
    doc.font('Bold').fontSize(9).fillColor(COLORS.accent);
    doc.text(`ТТН: ${order.trackingNumber}`, rightCol, doc.y, { width: 230 });
  }

  doc.moveDown(1);

  // Items table
  const colDefs = [
    { label: '№', x: PAGE_MARGIN + 5, width: 25, align: 'center' as const },
    { label: 'Код', x: PAGE_MARGIN + 32, width: 75 },
    { label: 'Назва товару', x: PAGE_MARGIN + 112, width: 180 },
    { label: 'Од.', x: PAGE_MARGIN + 297, width: 30, align: 'center' as const },
    { label: 'К-ть', x: PAGE_MARGIN + 332, width: 35, align: 'center' as const },
    { label: 'Ціна', x: PAGE_MARGIN + 372, width: 55, align: 'right' as const },
    { label: 'Сума', x: PAGE_MARGIN + 432, width: 58, align: 'right' as const },
  ];

  drawTableHeader(doc, colDefs);

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];

    if (doc.y > 700) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc);
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
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y).lineWidth(0.5).stroke(COLORS.border);
  doc.moveDown(0.5);

  // Total with styled block
  const totalY = doc.y;
  const totalsX = PAGE_MARGIN + 300;
  const totalsW = 195;
  doc.rect(totalsX - 5, totalY - 4, totalsW + 10, 22).fill(COLORS.primary);
  doc.font('Bold').fontSize(11).fillColor(COLORS.white);
  doc.text(`Всього: ${Number(order.totalAmount).toFixed(2)} грн`, totalsX, totalY, {
    width: totalsW,
    align: 'right',
  });

  // Signatures section
  doc.y = totalY + 50;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y).lineWidth(0.5).stroke(COLORS.border);
  doc.moveDown(1);

  doc.font('Regular').fontSize(9).fillColor(COLORS.textSecondary);

  const sigY = doc.y;
  // Left signature
  doc.text('Відпустив:', PAGE_MARGIN, sigY);
  doc.moveTo(PAGE_MARGIN + 60, sigY + 12).lineTo(PAGE_MARGIN + 200, sigY + 12).lineWidth(0.5).stroke(COLORS.border);

  // Right signature
  doc.text('Отримав:', rightCol, sigY);
  doc.moveTo(rightCol + 55, sigY + 12).lineTo(rightCol + 200, sigY + 12).lineWidth(0.5).stroke(COLORS.border);

  // Footer
  drawFooter(doc);

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

  const offersDir = path.join(env.UPLOAD_DIR, 'offers');
  if (!existsSync(offersDir)) {
    mkdirSync(offersDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `offer_${timestamp}.pdf`;
  const filePath = path.join(offersDir, fileName);
  const publicUrl = `/uploads/offers/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  setupDoc(doc);

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc);

  // Title
  drawDocTitle(
    doc,
    'Комерційна пропозиція',
    clientName ? `Для: ${clientName}` : '',
    new Date().toLocaleDateString('uk-UA')
  );

  doc.font('Regular').fontSize(9).fillColor(COLORS.text);
  doc.text('Шановний клієнте, пропонуємо Вам наступні товари:');
  doc.moveDown(0.8);

  // Items table
  const colDefs = [
    { label: '№', x: PAGE_MARGIN + 5, width: 25, align: 'center' as const },
    { label: 'Код', x: PAGE_MARGIN + 32, width: 80 },
    { label: 'Назва товару', x: PAGE_MARGIN + 117, width: 230 },
    { label: 'Ціна', x: PAGE_MARGIN + 352, width: 75, align: 'right' as const },
    { label: 'Од.', x: PAGE_MARGIN + 432, width: 58, align: 'center' as const },
  ];

  drawTableHeader(doc, colDefs);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    if (doc.y > 720) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc);
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
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y).lineWidth(0.5).stroke(COLORS.border);
  doc.moveDown(1);

  doc.font('Regular').fontSize(8).fillColor(COLORS.textSecondary);
  doc.text('Ціни вказані з ПДВ. Пропозиція дійсна протягом 14 днів.');
  doc.moveDown(0.3);
  doc.text(`Контакти: ${COMPANY.website}`);

  // Footer
  drawFooter(doc);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
