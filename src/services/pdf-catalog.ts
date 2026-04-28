import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import {
  BRAND,
  PAGE,
  setupDoc,
  drawHeader,
  drawDocTitle,
  drawTableHeader as drawThemedTableHeader,
  drawTableRow,
  drawFooter,
  getCompanyInfo,
} from '@/lib/pdf-theme';

export class PdfCatalogError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
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

    drawTableRow(
      doc,
      [
        { value: p.code, x: tableColumns[0].x, width: tableColumns[0].width },
        { value: p.name, x: tableColumns[1].x, width: tableColumns[1].width },
        { value: p.category?.name || '', x: tableColumns[2].x, width: tableColumns[2].width },
        {
          value: price.toFixed(2),
          x: tableColumns[3].x,
          width: tableColumns[3].width,
          align: 'right',
        },
        {
          value: p.quantity > 0 ? `${p.quantity}` : 'Немає',
          x: tableColumns[4].x,
          width: tableColumns[4].width,
          align: 'right',
        },
      ],
      i,
      16,
    );
  }

  // Footer info
  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor(BRAND.textSecondary)
    .text(`Загалом товарів: ${products.length}`, { align: 'center' });

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

const CARD_COLS = 2;
const CARD_ROWS = 3;
const CARDS_PER_PAGE = CARD_COLS * CARD_ROWS;
const CARD_GAP = 12;
const CARD_HEIGHT = 220;
const IMAGE_HEIGHT = 110;
const QR_SIZE = 56;

function readImageBuffer(imagePath: string | null): Buffer | null {
  if (!imagePath) return null;
  try {
    const cleaned = imagePath.replace(/^\/+/, '');
    const candidates = [
      path.join(env.UPLOAD_DIR, cleaned.replace(/^uploads\//, '')),
      path.join(process.cwd(), 'public', cleaned),
      path.join(process.cwd(), cleaned),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return readFileSync(candidate);
      }
    }
  } catch {
    // ignore — image is optional
  }
  return null;
}

async function buildQrPng(url: string): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: QR_SIZE * 2,
    });
  } catch {
    return null;
  }
}

interface CatalogProduct {
  id: number;
  code: string;
  name: string;
  slug: string;
  priceRetail: unknown;
  priceWholesale: unknown;
  quantity: number;
  isPromo: boolean;
  imagePath: string | null;
}

function drawProductCard(
  doc: InstanceType<typeof PDFDocument>,
  product: CatalogProduct,
  x: number,
  y: number,
  width: number,
  qrPng: Buffer | null,
): void {
  doc.roundedRect(x, y, width, CARD_HEIGHT, 6).lineWidth(0.5).stroke(BRAND.border);

  const imageBuffer = readImageBuffer(product.imagePath);
  const imgY = y + 8;
  if (imageBuffer) {
    try {
      doc.image(imageBuffer, x + 8, imgY, {
        width: width - 16,
        height: IMAGE_HEIGHT,
        fit: [width - 16, IMAGE_HEIGHT],
        align: 'center',
        valign: 'center',
      });
    } catch {
      doc.rect(x + 8, imgY, width - 16, IMAGE_HEIGHT).fill(BRAND.bgLight);
    }
  } else {
    doc.rect(x + 8, imgY, width - 16, IMAGE_HEIGHT).fill(BRAND.bgLight);
    doc
      .font('Regular')
      .fontSize(8)
      .fillColor(BRAND.textMuted)
      .text('Без фото', x + 8, imgY + IMAGE_HEIGHT / 2 - 4, {
        width: width - 16,
        align: 'center',
      });
  }

  if (product.isPromo) {
    const badgeW = 50;
    doc.roundedRect(x + width - badgeW - 8, y + 8, badgeW, 16, 4).fill(BRAND.danger);
    doc
      .font('Bold')
      .fontSize(8)
      .fillColor(BRAND.white)
      .text('АКЦІЯ', x + width - badgeW - 8, y + 12, { width: badgeW, align: 'center' });
  }

  // Text content below the image
  const textX = x + 10;
  const textWidth = width - 20 - QR_SIZE - 8;
  const textY = imgY + IMAGE_HEIGHT + 8;

  doc
    .font('Bold')
    .fontSize(9)
    .fillColor(BRAND.text)
    .text(product.name, textX, textY, { width: textWidth, height: 24, ellipsis: true });

  doc
    .font('Regular')
    .fontSize(7.5)
    .fillColor(BRAND.textSecondary)
    .text(`Код: ${product.code}`, textX, textY + 24, { width: textWidth });

  const retail = Number(product.priceRetail).toFixed(2);
  const wholesale = product.priceWholesale ? Number(product.priceWholesale).toFixed(2) : null;

  doc
    .font('Bold')
    .fontSize(10)
    .fillColor(BRAND.primaryDark)
    .text(`${retail} ₴`, textX, textY + 38, { width: textWidth });

  if (wholesale) {
    doc
      .font('Regular')
      .fontSize(7.5)
      .fillColor(BRAND.textSecondary)
      .text(`Опт: ${wholesale} ₴`, textX, textY + 52, { width: textWidth });
  }

  doc
    .font('Regular')
    .fontSize(7)
    .fillColor(product.quantity > 0 ? BRAND.success : BRAND.danger)
    .text(product.quantity > 0 ? 'У наявності' : 'Немає', textX, textY + 66, { width: textWidth });

  // QR code in the bottom-right corner
  if (qrPng) {
    try {
      doc.image(qrPng, x + width - QR_SIZE - 10, textY + 24, {
        width: QR_SIZE,
        height: QR_SIZE,
      });
    } catch {
      // ignore
    }
  }
}

export async function generateIllustratedCatalog(
  options: IllustratedCatalogOptions = {},
): Promise<string> {
  const company = await getCompanyInfo();
  const { categoryId, promoOnly } = options;

  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = categoryId;
  if (promoOnly) where.isPromo = true;

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      priceRetail: true,
      priceWholesale: true,
      quantity: true,
      isPromo: true,
      imagePath: true,
      category: { select: { name: true } },
    },
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

  // Pre-generate all QR codes in parallel — each links back to the product page
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const qrCodes = new Map<number, Buffer | null>();
  await Promise.all(
    products.map(async (p) => {
      const url = `${appUrl}/product/${p.slug}?utm_source=catalog_pdf&utm_medium=qr`;
      qrCodes.set(p.id, await buildQrPng(url));
    }),
  );

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  setupDoc(doc);
  doc.font('Regular');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Cover
  drawHeader(doc, company, 'Каталог товарів');
  drawDocTitle(doc, 'Каталог товарів', company.description, new Date().toLocaleDateString('uk-UA'));

  // Group products by category for the TOC
  const byCategory = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    const cat = p.category?.name || 'Без категорії';
    const list = byCategory.get(cat) ?? [];
    list.push(p);
    byCategory.set(cat, list);
  }

  // Table of contents
  drawFooter(doc, company);
  doc.addPage();
  drawHeader(doc, company);
  doc.font('Bold').fontSize(14).fillColor(BRAND.text).text('Зміст', { align: 'center' });
  doc.moveDown(1);
  let tocIndex = 1;
  for (const [cat, list] of byCategory) {
    doc
      .font('Regular')
      .fontSize(10)
      .fillColor(BRAND.text)
      .text(`${tocIndex}. ${cat} (${list.length} товарів)`);
    doc.moveDown(0.3);
    tocIndex++;
  }

  // Render product cards in a 2x3 grid grouped by category
  const M = 40;
  const contentWidth = PAGE.contentWidth;
  const cardWidth = (contentWidth - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS;

  for (const [cat, list] of byCategory) {
    drawFooter(doc, company);
    doc.addPage();
    drawHeader(doc, company);
    doc.font('Bold').fontSize(14).fillColor(BRAND.primaryDark).text(cat, { align: 'center' });
    doc.moveDown(0.6);

    let cardsOnPage = 0;
    let rowStartY = doc.y;

    for (const product of list) {
      if (cardsOnPage >= CARDS_PER_PAGE) {
        drawFooter(doc, company);
        doc.addPage();
        drawHeader(doc, company);
        doc.font('Bold').fontSize(12).fillColor(BRAND.primaryDark).text(cat, { align: 'center' });
        doc.moveDown(0.4);
        cardsOnPage = 0;
        rowStartY = doc.y;
      }

      const col = cardsOnPage % CARD_COLS;
      const row = Math.floor(cardsOnPage / CARD_COLS);
      const x = M + col * (cardWidth + CARD_GAP);
      const y = rowStartY + row * (CARD_HEIGHT + CARD_GAP);

      drawProductCard(doc, product, x, y, cardWidth, qrCodes.get(product.id) ?? null);

      cardsOnPage++;
    }
  }

  drawFooter(doc, company);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
