import PDFDocument from 'pdfkit';
import path from 'path';
import { getSettings } from '@/services/settings';

/**
 * Unified brand design system for all PDF documents.
 * Ensures consistent look across invoices, pricelists, analytics reports,
 * and all generated files.
 *
 * Brand: Порошок — clean, modern, professional
 * Primary color: #2563eb (Tailwind blue-600 — matches website)
 */

// ── Brand Colors ──

export const BRAND = {
  // Primary
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#dbeafe',

  // Text
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',

  // Backgrounds
  bgLight: '#f8fafc',
  bgAlt: '#f1f5f9',
  white: '#ffffff',

  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Semantic
  success: '#10b981',
  successBg: '#ecfdf5',
  warning: '#f59e0b',
  warningBg: '#fffbeb',
  danger: '#ef4444',
  dangerBg: '#fef2f2',

  // Accent (for promo badges, highlights)
  accent: '#8b5cf6',
  accentBg: '#f5f3ff',
} as const;

// ── Fonts ──

export const FONT_REGULAR = path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf');
export const FONT_BOLD = path.join(process.cwd(), 'src/assets/fonts/Roboto-Bold.ttf');

// ── Layout Constants ──

export const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 40,
  contentWidth: 515.28, // width - 2*margin
  footerY: 790,
} as const;

// ── Company Info Helper ──

export async function getCompanyInfo() {
  const s = await getSettings();
  return {
    name: s.site_name || 'Порошок',
    description: s.company_description || 'Інтернет-магазин побутової хімії',
    website: s.site_email?.split('@')[1] || 'poroshok.ua',
    phone: s.site_phone_display || '',
    email: s.site_email || '',
  };
}

export type CompanyInfo = Awaited<ReturnType<typeof getCompanyInfo>>;

// ── Document Setup ──

export function setupDoc(doc: InstanceType<typeof PDFDocument>) {
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold', FONT_BOLD);
}

// ── Reusable Drawing Functions ──

/** Brand header bar — blue gradient with company name and tagline */
export function drawHeader(
  doc: InstanceType<typeof PDFDocument>,
  company: CompanyInfo,
  subtitle?: string
) {
  const M = PAGE.margin;

  // Top accent bar (gradient effect with two rects)
  doc.rect(0, 0, PAGE.width, 5).fill(BRAND.primaryDark);
  doc.rect(0, 5, PAGE.width, 65).fill(BRAND.primary);

  // Company name
  doc.font('Bold').fontSize(20).fillColor(BRAND.white);
  doc.text(company.name, M, 16, { width: PAGE.contentWidth });

  // Tagline
  doc.font('Regular').fontSize(8).fillColor('#dbeafe');
  doc.text(subtitle || company.description, M, 40, { width: PAGE.contentWidth * 0.6 });

  // Right side: website + phone
  doc.font('Regular').fontSize(8).fillColor(BRAND.white);
  const rightX = PAGE.width - M - 150;
  doc.text(company.website, rightX, 22, { width: 150, align: 'right' });
  if (company.phone) {
    doc.text(company.phone, rightX, 34, { width: 150, align: 'right' });
  }

  doc.y = 85;
}

/** Document title with subtitle and date */
export function drawDocTitle(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  meta: string,
  date: string
) {
  const M = PAGE.margin;
  doc.font('Bold').fontSize(16).fillColor(BRAND.text);
  doc.text(title, M, doc.y, { width: PAGE.contentWidth });
  doc.moveDown(0.2);

  doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);
  doc.text(`${meta}  ·  ${date}`, M, doc.y, { width: PAGE.contentWidth });
  doc.moveDown(0.6);

  // Accent divider
  doc.rect(M, doc.y, 60, 3).fill(BRAND.primary);
  doc.rect(M + 60, doc.y, PAGE.contentWidth - 60, 1).fill(BRAND.border);
  doc.y += 12;
}

/** Section title with left accent bar */
export function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  const M = PAGE.margin;
  const y = doc.y;

  // Left accent bar
  doc.rect(M, y, 3, 14).fill(BRAND.primary);

  doc.font('Bold').fontSize(11).fillColor(BRAND.primaryDark);
  doc.text(title, M + 10, y + 1, { width: PAGE.contentWidth - 10 });
  doc.y = y + 20;
}

/** Info line: label + value */
export function drawInfoLine(doc: InstanceType<typeof PDFDocument>, label: string, value: string) {
  const M = PAGE.margin;
  const y = doc.y;
  doc.font('Bold').fontSize(8.5).fillColor(BRAND.textSecondary);
  doc.text(label, M + 10, y, { continued: true, width: 100 });
  doc.font('Regular').fontSize(8.5).fillColor(BRAND.text);
  doc.text(` ${value}`, { width: PAGE.contentWidth - 110 });
}

/** Styled table header row */
export function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  columns: { label: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[]
) {
  const M = PAGE.margin;
  const y = doc.y;

  // Header background
  doc.rect(M, y - 4, PAGE.contentWidth, 20).fill(BRAND.primaryDark);

  doc.font('Bold').fontSize(7.5).fillColor(BRAND.white);
  for (const col of columns) {
    doc.text(col.label, col.x, y, { width: col.width, align: col.align || 'left' });
  }

  doc.y = y + 20;
  doc.fillColor(BRAND.text);
}

/** Styled table data row with alternating backgrounds */
export function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  columns: { value: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[],
  rowIndex: number,
  rowHeight = 18
) {
  const M = PAGE.margin;
  const y = doc.y;

  // Alternating row background
  if (rowIndex % 2 === 0) {
    doc.rect(M, y - 3, PAGE.contentWidth, rowHeight).fill(BRAND.bgAlt);
  }

  doc.font('Regular').fontSize(7.5).fillColor(BRAND.text);
  for (const col of columns) {
    doc.text(col.value, col.x, y, { width: col.width, align: col.align || 'left' });
  }

  doc.y = y + rowHeight;
}

/** Total amount block — blue background with white text */
export function drawTotalBlock(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  amount: string
) {
  const blockW = 200;
  const blockX = PAGE.margin + PAGE.contentWidth - blockW;
  const y = doc.y;

  doc.rect(blockX - 5, y - 4, blockW + 10, 24)
    .fill(BRAND.primary);

  doc.font('Bold').fontSize(11).fillColor(BRAND.white);
  doc.text(`${label}: ${amount}`, blockX, y, { width: blockW, align: 'right' });
  doc.y = y + 30;
}

/** Page footer with company info */
export function drawFooter(doc: InstanceType<typeof PDFDocument>, company: CompanyInfo) {
  const M = PAGE.margin;
  const y = PAGE.footerY;

  // Footer line
  doc.rect(M, y, PAGE.contentWidth, 1).fill(BRAND.border);

  doc.font('Regular').fontSize(7).fillColor(BRAND.textMuted);
  doc.text(
    `${company.name}  ·  ${company.website}  ·  ${company.phone}`,
    M, y + 6,
    { width: PAGE.contentWidth, align: 'center' }
  );
}

/** Check if we need a page break, and if so add a new page with header */
export function checkPageBreak(
  doc: InstanceType<typeof PDFDocument>,
  company: CompanyInfo,
  threshold = 720
): boolean {
  if (doc.y > threshold) {
    drawFooter(doc, company);
    doc.addPage();
    drawHeader(doc, company);
    return true;
  }
  return false;
}

/** Badge / pill element */
export function drawBadge(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  color: string = BRAND.primary,
  bgColor: string = BRAND.primaryLight
) {
  const w = doc.widthOfString(text) + 12;
  doc.roundedRect(x, y - 2, w, 14, 4).fill(bgColor);
  doc.font('Bold').fontSize(7).fillColor(color);
  doc.text(text, x + 6, y + 1);
}

/** KPI card — for analytics dashboards */
export function drawKpiCard(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  change?: string
) {
  // Card background
  doc.roundedRect(x, y, width, 50, 6).fill(BRAND.bgLight);
  doc.roundedRect(x, y, width, 50, 6).lineWidth(0.5).stroke(BRAND.border);

  // Label
  doc.font('Regular').fontSize(7.5).fillColor(BRAND.textSecondary);
  doc.text(label, x + 10, y + 8, { width: width - 20 });

  // Value
  doc.font('Bold').fontSize(16).fillColor(BRAND.text);
  doc.text(value, x + 10, y + 22, { width: width - 20 });

  // Change indicator
  if (change) {
    const isPositive = change.startsWith('+');
    const color = isPositive ? BRAND.success : BRAND.danger;
    doc.font('Regular').fontSize(7).fillColor(color);
    doc.text(change, x + width - 50, y + 8, { width: 40, align: 'right' });
  }
}
