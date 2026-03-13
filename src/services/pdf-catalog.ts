import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { getSettings } from '@/services/settings';

export class PdfCatalogError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PdfCatalogError';
  }
}

const FONT_PATH = path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf');

interface PriceListOptions {
  type: 'retail' | 'wholesale';
  categoryId?: number;
}

export async function generatePriceList(options: PriceListOptions): Promise<string> {
  const s = await getSettings();
  const COMPANY = {
    name: s.site_name,
    description: s.company_description,
    website: s.site_email.split('@')[1] || 'poroshok.ua',
  };
  const { type, categoryId } = options;

  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = categoryId;

  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });

  if (products.length === 0) {
    throw new PdfCatalogError('Немає товарів для генерації');
  }

  const catalogDir = path.join(env.UPLOAD_DIR, 'catalogs');
  if (!existsSync(catalogDir)) {
    mkdirSync(catalogDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `pricelist_${type}_${timestamp}.pdf`;
  const filePath = path.join(catalogDir, fileName);
  const publicUrl = `/uploads/catalogs/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(18).text(COMPANY.name, { align: 'center' });
  doc.fontSize(10).text(COMPANY.website, { align: 'center' });
  doc.moveDown(0.5);
  doc
    .fontSize(14)
    .text(type === 'wholesale' ? 'Оптовий прайс-лист' : 'Роздрібний прайс-лист', { align: 'center' });
  doc.fontSize(9).text(`Дата: ${new Date().toLocaleDateString('uk-UA')}`, { align: 'center' });
  doc.moveDown(1);

  // Table header
  const colX = { code: 40, name: 110, category: 300, price: 420, stock: 500 };
  const drawTableHeader = (y: number) => {
    doc.fontSize(8).fillColor('#444');
    doc.text('Код', colX.code, y);
    doc.text('Назва', colX.name, y);
    doc.text('Категорія', colX.category, y);
    doc.text('Ціна, грн', colX.price, y, { width: 70, align: 'right' });
    doc.text('Наявність', colX.stock, y, { width: 50, align: 'right' });
    doc.moveTo(40, y + 12).lineTo(555, y + 12).stroke('#ccc');
    doc.fillColor('#000');
    return y + 20;
  };

  let y = drawTableHeader(doc.y);

  for (const p of products) {
    if (y > 760) {
      doc.addPage();
      y = drawTableHeader(40);
    }

    const price = type === 'wholesale' ? Number(p.priceWholesale) : Number(p.priceRetail);

    doc.fontSize(7);
    doc.text(p.code, colX.code, y, { width: 65 });
    doc.text(p.name, colX.name, y, { width: 185 });
    doc.text(p.category?.name || '', colX.category, y, { width: 115 });
    doc.text(price.toFixed(2), colX.price, y, { width: 70, align: 'right' });
    doc.text(p.quantity > 0 ? `${p.quantity}` : 'Немає', colX.stock, y, { width: 50, align: 'right' });

    y += 16;
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#666').text(`Загалом товарів: ${products.length}`, { align: 'center' });
  doc.text(`${COMPANY.name} | ${COMPANY.website}`, { align: 'center' });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}

interface IllustratedCatalogOptions {
  categoryId?: number;
  promoOnly?: boolean;
}

export async function generateIllustratedCatalog(options: IllustratedCatalogOptions = {}): Promise<string> {
  const s2 = await getSettings();
  const COMPANY = {
    name: s2.site_name,
    description: s2.company_description,
    website: s2.site_email.split('@')[1] || 'poroshok.ua',
  };
  const { categoryId, promoOnly } = options;

  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = categoryId;
  if (promoOnly) where.isPromo = true;

  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    take: 500,
  });

  if (products.length === 0) {
    throw new PdfCatalogError('Немає товарів для генерації');
  }

  const catalogDir = path.join(env.UPLOAD_DIR, 'catalogs');
  if (!existsSync(catalogDir)) {
    mkdirSync(catalogDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `catalog_illustrated_${timestamp}.pdf`;
  const filePath = path.join(catalogDir, fileName);
  const publicUrl = `/uploads/catalogs/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Title page
  doc.fontSize(24).text(COMPANY.name, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(16).text('Каталог товарів', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).text(new Date().toLocaleDateString('uk-UA'), { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(COMPANY.website, { align: 'center' });

  // Table of contents
  const categories = [...new Set(products.map((p) => p.category?.name || 'Без категорії'))];
  doc.addPage();
  doc.fontSize(14).text('Зміст', { align: 'center' });
  doc.moveDown(1);
  categories.forEach((cat, i) => {
    const count = products.filter((p) => (p.category?.name || 'Без категорії') === cat).length;
    doc.fontSize(10).text(`${i + 1}. ${cat} (${count} товарів)`);
    doc.moveDown(0.3);
  });

  // Products by category - 4 per page
  let currentCategory = '';
  let itemsOnPage = 0;

  for (const p of products) {
    const cat = p.category?.name || 'Без категорії';

    if (cat !== currentCategory) {
      doc.addPage();
      doc.fontSize(14).text(cat, { align: 'center' });
      doc.moveDown(1);
      currentCategory = cat;
      itemsOnPage = 0;
    }

    if (itemsOnPage >= 5) {
      doc.addPage();
      doc.fontSize(12).text(cat, { align: 'center' });
      doc.moveDown(0.5);
      itemsOnPage = 0;
    }

    const y = doc.y;

    doc.fontSize(10).text(`${p.code} — ${p.name}`, 40, y, { width: 400 });
    doc.fontSize(9).fillColor('#666');
    doc.text(`Роздріб: ${Number(p.priceRetail).toFixed(2)} грн | Опт: ${Number(p.priceWholesale).toFixed(2)} грн`, 40, y + 15);
    doc.text(`Наявність: ${p.quantity > 0 ? `${p.quantity} шт.` : 'Немає'}`, 40, y + 27);
    if (p.isPromo) {
      doc.fillColor('#ef4444').text('АКЦІЯ', 480, y, { width: 70, align: 'right' });
    }
    doc.fillColor('#000');
    doc.moveTo(40, y + 42).lineTo(555, y + 42).stroke('#eee');
    doc.y = y + 50;

    itemsOnPage++;
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
