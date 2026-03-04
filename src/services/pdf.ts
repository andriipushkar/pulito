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

const FONT_PATH = path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf');

const COMPANY = {
  name: 'Порошок',
  description: 'Інтернет-магазин побутової хімії',
  website: 'poroshok.ua',
};

/**
 * @description Генерує PDF рахунку-фактури для замовлення.
 * @param orderId - Ідентифікатор замовлення
 * @returns Публічний URL згенерованого PDF-файлу
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

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text(COMPANY.name, { align: 'center' });
  doc.fontSize(10).text(COMPANY.description, { align: 'center' });
  doc.fontSize(10).text(COMPANY.website, { align: 'center' });
  doc.moveDown(1.5);

  // Invoice title
  doc.fontSize(16).text(`Рахунок-фактура #${order.orderNumber}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Дата: ${order.createdAt.toLocaleDateString('uk-UA')}`, { align: 'center' });
  doc.moveDown(1.5);

  // Client info
  doc.fontSize(12).text('Інформація про клієнта:');
  doc.fontSize(10);
  doc.text(`Ім'я: ${order.contactName}`);
  doc.text(`Телефон: ${order.contactPhone}`);
  if (order.contactEmail) doc.text(`Email: ${order.contactEmail}`);
  if (order.deliveryCity) doc.text(`Місто: ${order.deliveryCity}`);
  if (order.deliveryAddress) doc.text(`Адреса: ${order.deliveryAddress}`);
  doc.moveDown(1);

  // Items table
  const tableTop = doc.y;
  const colX = { code: 50, name: 130, price: 320, qty: 400, sum: 460 };

  // Table header
  doc.fontSize(9).fillColor('#444444');
  doc.text('Код', colX.code, tableTop);
  doc.text('Назва', colX.name, tableTop);
  doc.text('Ціна', colX.price, tableTop, { width: 70, align: 'right' });
  doc.text('К-ть', colX.qty, tableTop, { width: 50, align: 'right' });
  doc.text('Сума', colX.sum, tableTop, { width: 80, align: 'right' });

  doc
    .moveTo(50, tableTop + 15)
    .lineTo(540, tableTop + 15)
    .stroke('#cccccc');

  // Table rows
  let y = tableTop + 25;
  doc.fillColor('#000000');

  for (const item of order.items) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.fontSize(8);
    doc.text(item.productCode || '-', colX.code, y, { width: 75 });
    doc.text(item.productName, colX.name, y, { width: 185 });
    doc.text(`${Number(item.priceAtOrder).toFixed(2)}`, colX.price, y, { width: 70, align: 'right' });
    doc.text(`${item.quantity}`, colX.qty, y, { width: 50, align: 'right' });
    doc.text(`${Number(item.subtotal).toFixed(2)}`, colX.sum, y, { width: 80, align: 'right' });

    y += 20;
  }

  // Separator
  doc
    .moveTo(50, y)
    .lineTo(540, y)
    .stroke('#cccccc');
  y += 15;

  // Totals
  doc.fontSize(10);

  if (Number(order.discountAmount) > 0) {
    doc.text(`Знижка: -${Number(order.discountAmount).toFixed(2)} грн`, colX.price, y, {
      width: 180,
      align: 'right',
    });
    y += 18;
  }

  if (Number(order.deliveryCost) > 0) {
    doc.text(`Доставка: ${Number(order.deliveryCost).toFixed(2)} грн`, colX.price, y, {
      width: 180,
      align: 'right',
    });
    y += 18;
  }

  doc.fontSize(12).text(`Всього: ${Number(order.totalAmount).toFixed(2)} грн`, colX.price, y, {
    width: 180,
    align: 'right',
  });

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
 * Generate a delivery note (видаткова накладна) PDF for an order.
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

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text(COMPANY.name, { align: 'center' });
  doc.fontSize(10).text(COMPANY.description, { align: 'center' });
  doc.moveDown(1.5);

  // Title
  doc.fontSize(16).text(`Видаткова накладна #${order.orderNumber}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Дата: ${order.createdAt.toLocaleDateString('uk-UA')}`, { align: 'center' });
  doc.moveDown(1.5);

  // Supplier info
  doc.fontSize(12).text('Постачальник:');
  doc.fontSize(10);
  doc.text(`${COMPANY.name} — ${COMPANY.description}`);
  doc.text(`Сайт: ${COMPANY.website}`);
  doc.moveDown(1);

  // Client info
  doc.fontSize(12).text('Отримувач:');
  doc.fontSize(10);
  doc.text(`Ім'я: ${order.contactName}`);
  doc.text(`Телефон: ${order.contactPhone}`);
  if (order.contactEmail) doc.text(`Email: ${order.contactEmail}`);
  if (order.deliveryCity) doc.text(`Місто: ${order.deliveryCity}`);
  if (order.deliveryAddress) doc.text(`Адреса: ${order.deliveryAddress}`);
  if (order.trackingNumber) doc.text(`ТТН: ${order.trackingNumber}`);
  doc.moveDown(1);

  // Items table
  const tableTop = doc.y;
  const colX = { num: 50, code: 75, name: 155, unit: 320, qty: 370, price: 420, sum: 475 };

  doc.fontSize(8).fillColor('#444444');
  doc.text('№', colX.num, tableTop, { width: 20 });
  doc.text('Код', colX.code, tableTop, { width: 75 });
  doc.text('Назва', colX.name, tableTop, { width: 160 });
  doc.text('Од.', colX.unit, tableTop, { width: 40 });
  doc.text('К-ть', colX.qty, tableTop, { width: 45, align: 'right' });
  doc.text('Ціна', colX.price, tableTop, { width: 50, align: 'right' });
  doc.text('Сума', colX.sum, tableTop, { width: 65, align: 'right' });

  doc.moveTo(50, tableTop + 14).lineTo(540, tableTop + 14).stroke('#cccccc');

  let y = tableTop + 22;
  doc.fillColor('#000000');

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.fontSize(8);
    doc.text(String(i + 1), colX.num, y, { width: 20 });
    doc.text(item.productCode || '-', colX.code, y, { width: 75 });
    doc.text(item.productName, colX.name, y, { width: 160 });
    doc.text('шт.', colX.unit, y, { width: 40 });
    doc.text(String(item.quantity), colX.qty, y, { width: 45, align: 'right' });
    doc.text(`${Number(item.priceAtOrder).toFixed(2)}`, colX.price, y, { width: 50, align: 'right' });
    doc.text(`${Number(item.subtotal).toFixed(2)}`, colX.sum, y, { width: 65, align: 'right' });

    y += 18;
  }

  doc.moveTo(50, y).lineTo(540, y).stroke('#cccccc');
  y += 15;

  doc.fontSize(11).text(`Всього: ${Number(order.totalAmount).toFixed(2)} грн`, 300, y, {
    width: 240,
    align: 'right',
  });
  y += 30;

  // Signatures
  doc.fontSize(10);
  doc.text('Відпустив: ___________________', 50, y);
  doc.text('Отримав: ___________________', 300, y);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}

/**
 * Generate a commercial offer (комерційна пропозиція) PDF for selected products.
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

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text(COMPANY.name, { align: 'center' });
  doc.fontSize(10).text(COMPANY.description, { align: 'center' });
  doc.fontSize(10).text(COMPANY.website, { align: 'center' });
  doc.moveDown(1.5);

  // Title
  doc.fontSize(16).text('Комерційна пропозиція', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Дата: ${new Date().toLocaleDateString('uk-UA')}`, { align: 'center' });
  doc.moveDown(1);

  if (clientName) {
    doc.fontSize(12).text(`Для: ${clientName}`);
    doc.moveDown(1);
  }

  doc.fontSize(10).text('Шановний клієнте, пропонуємо Вам наступні товари:');
  doc.moveDown(0.5);

  // Items table
  const tableTop = doc.y;
  const colX = { num: 50, code: 75, name: 155, price: 400, unit: 480 };

  doc.fontSize(8).fillColor('#444444');
  doc.text('№', colX.num, tableTop, { width: 20 });
  doc.text('Код', colX.code, tableTop, { width: 75 });
  doc.text('Назва', colX.name, tableTop, { width: 240 });
  doc.text('Ціна', colX.price, tableTop, { width: 75, align: 'right' });
  doc.text('Од.', colX.unit, tableTop, { width: 50 });

  doc.moveTo(50, tableTop + 14).lineTo(540, tableTop + 14).stroke('#cccccc');

  let y = tableTop + 22;
  doc.fillColor('#000000');

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.fontSize(8);
    doc.text(String(i + 1), colX.num, y, { width: 20 });
    doc.text(p.code, colX.code, y, { width: 75 });
    doc.text(p.name, colX.name, y, { width: 240 });
    doc.text(`${p.price.toFixed(2)} грн`, colX.price, y, { width: 75, align: 'right' });
    doc.text(p.unit || 'шт.', colX.unit, y, { width: 50 });

    y += 18;
  }

  doc.moveTo(50, y).lineTo(540, y).stroke('#cccccc');
  y += 20;

  doc.fontSize(10).text('Ціни вказані з ПДВ. Пропозиція дійсна протягом 14 днів.', 50, y);
  y += 30;
  doc.text(`Контакти: ${COMPANY.website}`, 50, y);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
