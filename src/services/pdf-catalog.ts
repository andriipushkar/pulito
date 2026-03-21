import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import {
  BRAND, FONT_REGULAR, FONT_BOLD, PAGE, setupDoc, drawHeader, drawDocTitle,
  drawTableHeader as drawThemedTableHeader, drawTableRow, drawFooter, getCompanyInfo,
} from '@/lib/pdf-theme';

export class PdfCatalogError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PdfCatalogError';
  }
}

interface PriceListOptions {
  type: 'retail' | 'wholesale';
  categoryId?: number;
}

export async function generatePriceList(options: PriceListOptions): Promise<string> {
  const company = await getCompanyInfo();
  const { type, categoryId } = options;

  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = categoryId;

  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    take: 5000,
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
  setupDoc(doc);
  doc.font('Regular');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc, company);
  drawDocTitle(
    doc,
    type === 'wholesale' ? 'Оптовий прайс-лист' : 'Роздрібний прайс-лист',
    company.description,
    new Date().toLocaleDateString('uk-UA'),
  );

  // Table header — columns span full content width (515)
  const M = PAGE.margin;
  const tableColumns = [
    { label: 'Код', x: M, width: 65 },
    { label: 'Назва', x: M + 70, width: 210 },
    { label: 'Категорія', x: M + 285, width: 100 },
    { label: 'Ціна, грн', x: M + 390, width: 60, align: 'right' as const },
    { label: 'Наявність', x: M + 455, width: 60, align: 'right' as const },
  ];

  const drawLocalTableHeader = () => {
    drawThemedTableHeader(doc, tableColumns);
  };

  drawLocalTableHeader();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    if (doc.y > 760) {
      drawFooter(doc, company);
      doc.addPage();
      drawHeader(doc, company);
      drawLocalTableHeader();
    }

    const price = type === 'wholesale' ? Number(p.priceWholesale) : Number(p.priceRetail);

    drawTableRow(doc, [
      { value: p.code, x: tableColumns[0].x, width: tableColumns[0].width },
      { value: p.name, x: tableColumns[1].x, width: tableColumns[1].width },
      { value: p.category?.name || '', x: tableColumns[2].x, width: tableColumns[2].width },
      { value: price.toFixed(2), x: tableColumns[3].x, width: tableColumns[3].width, align: 'right' },
      { value: p.quantity > 0 ? `${p.quantity}` : 'Немає', x: tableColumns[4].x, width: tableColumns[4].width, align: 'right' },
    ], i, 16);
  }

  // Footer info
  doc.moveDown(2);
  doc.fontSize(8).fillColor(BRAND.textSecondary).text(`Загалом товарів: ${products.length}`, { align: 'center' });

  drawFooter(doc, company);
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
  const company = await getCompanyInfo();
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
  setupDoc(doc);
  doc.font('Regular');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Title page
  drawHeader(doc, company, 'Каталог товарів');
  drawDocTitle(doc, 'Каталог товарів', company.description, new Date().toLocaleDateString('uk-UA'));

  // Table of contents
  const categories = [...new Set(products.map((p) => p.category?.name || 'Без категорії'))];
  drawFooter(doc, company);
  doc.addPage();
  drawHeader(doc, company);
  doc.font('Bold').fontSize(14).fillColor(BRAND.text).text('Зміст', { align: 'center' });
  doc.moveDown(1);
  categories.forEach((cat, i) => {
    const count = products.filter((p) => (p.category?.name || 'Без категорії') === cat).length;
    doc.font('Regular').fontSize(10).fillColor(BRAND.text).text(`${i + 1}. ${cat} (${count} товарів)`);
    doc.moveDown(0.3);
  });

  // Products by category - 5 per page
  let currentCategory = '';
  let itemsOnPage = 0;

  for (const p of products) {
    const cat = p.category?.name || 'Без категорії';

    if (cat !== currentCategory) {
      drawFooter(doc, company);
      doc.addPage();
      drawHeader(doc, company);
      doc.font('Bold').fontSize(14).fillColor(BRAND.primaryDark).text(cat, { align: 'center' });
      doc.moveDown(1);
      currentCategory = cat;
      itemsOnPage = 0;
    }

    if (itemsOnPage >= 5) {
      drawFooter(doc, company);
      doc.addPage();
      drawHeader(doc, company);
      doc.font('Bold').fontSize(12).fillColor(BRAND.primaryDark).text(cat, { align: 'center' });
      doc.moveDown(0.5);
      itemsOnPage = 0;
    }

    const y = doc.y;

    doc.font('Bold').fontSize(10).fillColor(BRAND.text).text(`${p.code} — ${p.name}`, 40, y, { width: 400 });
    doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);
    doc.text(`Роздріб: ${Number(p.priceRetail).toFixed(2)} грн | Опт: ${Number(p.priceWholesale).toFixed(2)} грн`, 40, y + 15);
    doc.text(`Наявність: ${p.quantity > 0 ? `${p.quantity} шт.` : 'Немає'}`, 40, y + 27);
    if (p.isPromo) {
      doc.fillColor(BRAND.danger).text('АКЦІЯ', 480, y, { width: 70, align: 'right' });
    }
    doc.fillColor(BRAND.text);
    doc.moveTo(40, y + 42).lineTo(555, y + 42).stroke(BRAND.borderLight);
    doc.y = y + 50;

    itemsOnPage++;
  }

  drawFooter(doc, company);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
