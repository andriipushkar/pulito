import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';
import { BRAND, FONT_REGULAR, FONT_BOLD, getCompanyInfo } from '@/lib/pdf-theme';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

// A4 layout
const PW = 595.28;
const PH = 841.89;
const M = 40; // margin
const CW = PW - M * 2; // content width
const IMG = 34;
const ROW = 46;

// Color aliases — mapped from unified brand theme
const C = {
  accent: BRAND.primary,
  accentSoft: BRAND.primaryLight,
  accentMid: BRAND.primaryLight,
  dark: BRAND.text,
  text: BRAND.textSecondary,
  sub: BRAND.textMuted,
  line: BRAND.border,
  bgAlt: BRAND.bgLight,
  green: BRAND.success,
  greenBg: BRAND.successBg,
  red: BRAND.danger,
  redBg: BRAND.dangerBg,
  imgBg: BRAND.bgAlt,
};

export class PricelistError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'PricelistError';
  }
}

// ── Image helpers ──

async function toPngOrJpeg(buf: Buffer): Promise<Buffer> {
  if (buf[0] === 0xff && buf[1] === 0xd8) return buf;
  if (buf[0] === 0x89 && buf[1] === 0x50) return buf;
  return sharp(buf).resize(80, 80, { fit: 'inside' }).png().toBuffer();
}

async function loadImage(imgPath: string | null): Promise<Buffer | null> {
  if (!imgPath) return null;
  let raw: Buffer | null = null;

  try {
    const local = path.join(PUBLIC_DIR, imgPath);
    if (fs.existsSync(local)) raw = fs.readFileSync(local);
  } catch { /* */ }

  if (!raw) {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const url = imgPath.startsWith('http') ? imgPath : `${base}${imgPath}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.ok) raw = Buffer.from(await r.arrayBuffer());
    } catch { /* */ }
  }

  if (!raw) return null;
  try { return await toPngOrJpeg(raw); } catch { return null; }
}

function fmtPrice(n: number): string {
  return n.toFixed(2);
}

// ── Rounded rect helper ──
function roundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number) {
  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);
}

// ── Main generator ──

export async function generatePricelist(type: 'retail' | 'wholesale'): Promise<Buffer> {
  const info = await getCompanyInfo();
  const s = await getSettings();
  const COMPANY = {
    name: info.name,
    tagline: info.description,
    website: info.website,
    phone: info.phone,
    social: {
      telegram: s.social_telegram.replace('https://', ''),
      viber: s.social_viber.replace('viber://pa?chatURI=', ''),
      instagram: s.social_instagram.replace('https://', ''),
      facebook: s.social_facebook.replace('https://www.', ''),
    },
  };

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
      images: { where: { isMain: true }, select: { pathThumbnail: true, pathMedium: true }, take: 1 },
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });

  if (!products.length) {
    throw new PricelistError('Немає активних товарів для генерації прайс-листа');
  }

  const grouped = new Map<string, typeof products>();
  for (const p of products) {
    const cat = p.category?.name || 'Інше';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  const hasBold = fs.existsSync(FONT_BOLD);
  const doc = new PDFDocument({ size: 'A4', margin: M, autoFirstPage: false });
  doc.registerFont('R', FONT_REGULAR);
  if (hasBold) doc.registerFont('B', FONT_BOLD);
  doc.font('R');

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  let pageNum = 0;

  // Column positions
  const NUM_W = 22; // width for row number column
  const col = {
    num: M,
    img: M + NUM_W,
    name: M + NUM_W + IMG + 10,
    price: PW - M - 100,
    stock: PW - M - 38,
  };

  // ── Page header ──
  const drawHeader = (): number => {
    // Top accent gradient (two bars)
    doc.rect(0, 0, PW, 5).fill(C.accent);
    doc.rect(0, 5, PW, 2).fill(C.accentMid);

    // Company name
    if (hasBold) doc.font('B');
    doc.fontSize(20).fillColor(C.accent);
    doc.text(COMPANY.name, M, 22, { lineBreak: false });

    // Tagline
    doc.font('R').fontSize(8).fillColor(C.sub);
    doc.text(COMPANY.tagline, M, 46, { lineBreak: false });

    // Right: type badge
    const typeLabel = type === 'wholesale' ? 'ОПТОВИЙ ПРАЙС' : 'РОЗДРІБНИЙ ПРАЙС';
    const badgeW = 130;
    const badgeX = PW - M - badgeW;
    roundedRect(doc, badgeX, 20, badgeW, 22, 4);
    doc.fill(C.accentSoft);
    if (hasBold) doc.font('B');
    doc.fontSize(8).fillColor(C.accent);
    doc.text(typeLabel, badgeX, 27, { width: badgeW, align: 'center', lineBreak: false });

    // Right: date & contacts
    doc.font('R').fontSize(7).fillColor(C.sub);
    doc.text(new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
      M, 48, { width: CW, align: 'right', lineBreak: false });
    doc.text(`${COMPANY.website}  •  ${COMPANY.phone}`,
      M, 58, { width: CW, align: 'right', lineBreak: false });

    // Social media line
    const socials = `Telegram: ${COMPANY.social.telegram}  •  Viber: ${COMPANY.social.viber}  •  Instagram: ${COMPANY.social.instagram}  •  Facebook: ${COMPANY.social.facebook}`;
    doc.fontSize(6.5).fillColor(C.accent);
    doc.text(socials, M, 68, { width: CW, align: 'right', lineBreak: false });

    // Separator
    doc.moveTo(M, 80).lineTo(PW - M, 80).lineWidth(0.5).stroke(C.line);

    return 88;
  };

  // ── Table column header ──
  const drawColHeader = (y: number): number => {
    roundedRect(doc, M, y, CW, 18, 3);
    doc.fill(C.accentSoft);

    if (hasBold) doc.font('B');
    doc.fontSize(6.5).fillColor(C.accent);
    const ty = y + 5;
    doc.text('№', col.num + 2, ty, { width: NUM_W, align: 'center', lineBreak: false });
    doc.text('ФОТО', col.img + 4, ty, { width: 30, lineBreak: false });
    doc.text('ТОВАР / КОД', col.name, ty, { width: 200, lineBreak: false });
    doc.text('ЦІНА, ₴', col.price, ty, { width: 55, align: 'right', lineBreak: false });
    doc.text('НАЯВНІСТЬ', col.stock, ty, { width: 38, align: 'right', lineBreak: false });
    doc.font('R').fillColor(C.dark);

    return y + 22;
  };

  // ── Category header ──
  const drawCategory = (y: number, name: string, count: number): number => {
    // Accent line left + light bg
    roundedRect(doc, M, y, CW, 22, 3);
    doc.fill('#f0f4ff');
    doc.rect(M, y + 2, 3, 18).fill(C.accent);

    if (hasBold) doc.font('B');
    doc.fontSize(9).fillColor(C.dark);
    doc.text(name, M + 12, y + 6, { lineBreak: false });

    // Count badge
    const countText = `${count}`;
    const cw = doc.widthOfString(countText) + 12;
    roundedRect(doc, PW - M - cw - 6, y + 4, cw, 14, 7);
    doc.fill(C.accentMid);
    doc.font('R').fontSize(7).fillColor(C.accent);
    doc.text(countText, PW - M - cw - 6, y + 7, { width: cw, align: 'center', lineBreak: false });

    doc.fillColor(C.dark).font('R');
    return y + 28;
  };

  // ── Product row ──
  let rowNum = 0;
  const drawRow = async (y: number, p: typeof products[0], odd: boolean): Promise<number> => {
    rowNum++;

    // Row background
    if (odd) {
      doc.rect(M, y, CW, ROW).fill(C.bgAlt);
    }

    // Row number
    doc.font('R').fontSize(7).fillColor(C.sub);
    doc.text(`${rowNum}`, col.num, y + (ROW - 7) / 2, { width: NUM_W, align: 'center', lineBreak: false });

    // Image
    const imgPath = p.images?.[0]?.pathThumbnail || p.images?.[0]?.pathMedium || p.imagePath;
    const imgBuf = await loadImage(imgPath);
    const imgY = y + (ROW - IMG) / 2;

    if (imgBuf) {
      try {
        // Soft rounded bg behind image
        roundedRect(doc, col.img + 1, imgY - 1, IMG + 2, IMG + 2, 4);
        doc.fill(C.imgBg);
        doc.image(imgBuf, col.img + 2, imgY, { fit: [IMG, IMG], align: 'center', valign: 'center' });
      } catch {
        roundedRect(doc, col.img + 1, imgY - 1, IMG + 2, IMG + 2, 4);
        doc.fill(C.imgBg);
      }
    } else {
      // Subtle rounded placeholder
      roundedRect(doc, col.img + 1, imgY - 1, IMG + 2, IMG + 2, 4);
      doc.fill(C.imgBg);
    }

    // Product name (truncate to prevent page overflow)
    const nameY = y + 8;
    if (hasBold) doc.font('B');
    doc.fontSize(8).fillColor(C.dark);
    const nameW = col.price - col.name - 12;
    let displayName = p.name;
    while (doc.widthOfString(displayName) > nameW && displayName.length > 10) {
      displayName = displayName.slice(0, -4) + '...';
    }
    doc.text(displayName, col.name, nameY, { width: nameW, lineBreak: false });

    // Code
    doc.font('R').fontSize(6).fillColor(C.sub);
    doc.text(p.code, col.name, nameY + 16, { width: nameW, lineBreak: false });

    // Price
    const price = type === 'wholesale'
      ? (p.priceWholesale !== null ? Number(p.priceWholesale) : Number(p.priceRetail))
      : Number(p.priceRetail);

    if (hasBold) doc.font('B');
    doc.fontSize(9).fillColor(C.dark);
    doc.text(fmtPrice(price), col.price, y + 14, { width: 55, align: 'right', lineBreak: false });
    doc.font('R');

    // Availability badge
    const inStock = p.quantity > 0;
    const stockText = inStock ? 'Так' : 'Ні';
    const stockW = 32;
    const stockX = PW - M - stockW - 3;
    const stockY = y + 12;

    roundedRect(doc, stockX, stockY, stockW, 16, 8);
    doc.fill(inStock ? C.greenBg : C.redBg);

    doc.fontSize(6.5).fillColor(inStock ? C.green : C.red);
    doc.text(stockText, stockX, stockY + 4, { width: stockW, align: 'center', lineBreak: false });
    doc.fillColor(C.dark);

    // Bottom separator
    doc.moveTo(M + 8, y + ROW - 1).lineTo(PW - M - 8, y + ROW - 1)
      .lineWidth(0.2).stroke(C.line);

    return y + ROW;
  };

  // ── Footer helper (draws on current page) ──
  const drawFooter = () => {
    const fy = PH - 28;
    doc.moveTo(M, fy).lineTo(PW - M, fy).lineWidth(0.3).stroke(C.line);

    // Temporarily disable auto-paging (text at bottom would trigger new page)
    const savedMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.font('R').fontSize(6.5).fillColor(C.sub);
    doc.text(`© ${new Date().getFullYear()} ${COMPANY.name}  •  ${COMPANY.website}`, M, fy + 6, { lineBreak: false });
    doc.text(`Стор. ${pageNum}`, M, fy + 6, { width: CW, align: 'right', lineBreak: false });

    doc.page.margins.bottom = savedMargin;
  };

  // ── New page helper ──
  const newPage = (): number => {
    if (pageNum > 0) drawFooter(); // footer on previous page
    doc.addPage();
    pageNum++;
    let ny = drawHeader();
    ny = drawColHeader(ny);
    return ny;
  };

  // ── Build pages ──
  let y = newPage();
  let odd = false;

  for (const [catName, catProducts] of grouped) {
    // Need space for category + at least 1 row
    if (y > PH - M - ROW - 50) {
      y = newPage();
      odd = false;
    }

    y = drawCategory(y, catName, catProducts.length);

    for (const p of catProducts) {
      if (y > PH - M - 50) {
        y = newPage();
        odd = false;
      }

      y = await drawRow(y, p, odd);
      odd = !odd;
    }

    // Small gap between categories
    y += 4;
  }

  // Footer on last page + total
  {
    const fy = PH - 28;
    doc.moveTo(M, fy).lineTo(PW - M, fy).lineWidth(0.3).stroke(C.line);

    const savedMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.font('R').fontSize(6.5).fillColor(C.sub);
    doc.text(`© ${new Date().getFullYear()} ${COMPANY.name}  •  ${COMPANY.website}`, M, fy + 6, { lineBreak: false });
    doc.text(`${products.length} товарів у каталозі`, M, fy + 6, { width: CW, align: 'center', lineBreak: false });
    doc.text(`Стор. ${pageNum}`, M, fy + 6, { width: CW, align: 'right', lineBreak: false });

    doc.page.margins.bottom = savedMargin;
  }

  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.end();
  return result;
}
