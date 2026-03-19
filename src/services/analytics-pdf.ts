import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import {
  BRAND,
  FONT_REGULAR,
  PAGE,
  setupDoc,
  drawHeader,
  drawDocTitle,
  drawSectionTitle,
  drawTableHeader,
  drawTableRow,
  drawFooter,
  drawKpiCard,
  getCompanyInfo,
  checkPageBreak,
} from '@/lib/pdf-theme';
import type { CompanyInfo } from '@/lib/pdf-theme';
import {
  getStockAnalytics,
  getPriceAnalytics,
  getChannelAnalytics,
  getGeographyAnalytics,
  getCustomerLTV,
  getCustomerSegmentation,
} from './analytics-reports';

type ReportType = 'stock' | 'price' | 'channels' | 'geography' | 'ltv' | 'segments' | 'summary';

export async function generateAnalyticsPdf(reportType: ReportType, days: number = 30): Promise<string> {
  const reportsDir = path.join(env.UPLOAD_DIR, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `analytics_${reportType}_${timestamp}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const publicUrl = `/uploads/reports/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin });
  setupDoc(doc);
  doc.font('Regular');

  const company = await getCompanyInfo();

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc, company, 'Аналітичний звіт');

  const dateRange = `Період: ${days} днів (до ${new Date().toLocaleDateString('uk-UA')})`;
  const reportTitles: Record<ReportType, string> = {
    stock: 'Аналітика залишків',
    price: 'Аналітика цін',
    channels: 'Аналітика каналів',
    geography: 'Географія замовлень',
    ltv: 'Customer Lifetime Value',
    segments: 'Сегментація клієнтів',
    summary: 'Загальний звіт',
  };
  drawDocTitle(doc, reportTitles[reportType], 'Аналітичний звіт', dateRange);

  switch (reportType) {
    case 'stock':
      await renderStockReport(doc, days, company);
      break;
    case 'price':
      await renderPriceReport(doc, days, company);
      break;
    case 'channels':
      await renderChannelsReport(doc, days, company);
      break;
    case 'geography':
      await renderGeographyReport(doc, days, company);
      break;
    case 'ltv':
      await renderLTVReport(doc, days, company);
      break;
    case 'segments':
      await renderSegmentsReport(doc, company);
      break;
    case 'summary':
      await renderSummaryReport(doc, days, company);
      break;
  }

  drawFooter(doc, company);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}

async function renderStockReport(doc: PDFKit.PDFDocument, days: number, company: CompanyInfo) {
  const data = await getStockAnalytics(days);

  drawSectionTitle(doc, 'Аналітика залишків');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Активних товарів: ${data.summary.totalProducts}`, PAGE.margin, doc.y);
  doc.text(`Критичний запас: ${data.summary.criticalCount}`);
  doc.text(`Dead stock (60+ днів): ${data.summary.deadStockCount}`);
  doc.text(`Середня оборотність: ${data.summary.avgTurnover}`);
  doc.moveDown(1);

  // Critical stock table
  drawSectionTitle(doc, 'Критичні залишки (< 14 днів)');

  const M = PAGE.margin;
  const cols = [
    { label: 'Код', x: M, width: 75 },
    { label: 'Назва', x: M + 80, width: 230 },
    { label: 'Залишок', x: M + 315, width: 60, align: 'right' as const },
    { label: 'Прод./день', x: M + 380, width: 65, align: 'right' as const },
    { label: 'Днів до 0', x: M + 450, width: 65, align: 'right' as const },
  ];

  drawTableHeader(doc, cols);

  for (let i = 0; i < Math.min(data.criticalStock.length, 30); i++) {
    const item = data.criticalStock[i];
    checkPageBreak(doc, company);
    drawTableRow(doc, [
      { value: item.code, x: cols[0].x, width: cols[0].width },
      { value: item.name.slice(0, 40), x: cols[1].x, width: cols[1].width },
      { value: String(item.quantity), x: cols[2].x, width: cols[2].width, align: 'right' },
      { value: String(item.avgDailySales), x: cols[3].x, width: cols[3].width, align: 'right' },
      { value: item.daysUntilOut !== null ? String(item.daysUntilOut) : '—', x: cols[4].x, width: cols[4].width, align: 'right' },
    ], i);
  }
}

async function renderPriceReport(doc: PDFKit.PDFDocument, days: number, company: CompanyInfo) {
  const data = await getPriceAnalytics(days);

  drawSectionTitle(doc, 'Аналітика цін');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Змін цін: ${data.summary.totalChanges}`, PAGE.margin, doc.y);
  doc.text(`Підвищення: ${data.summary.priceIncreases} | Зниження: ${data.summary.priceDecreases}`);
  doc.text(`Середня зміна: ${data.summary.avgChangePercent}%`);
  doc.moveDown(1);

  drawSectionTitle(doc, 'Останні зміни цін');

  const M = PAGE.margin;
  const cols = [
    { label: 'Код', x: M, width: 70 },
    { label: 'Назва', x: M + 75, width: 200 },
    { label: 'Стара ціна', x: M + 280, width: 70, align: 'right' as const },
    { label: 'Нова ціна', x: M + 355, width: 70, align: 'right' as const },
    { label: 'Зміна %', x: M + 430, width: 85, align: 'right' as const },
  ];

  drawTableHeader(doc, cols);

  for (let i = 0; i < Math.min(data.changes.length, 40); i++) {
    const c = data.changes[i];
    checkPageBreak(doc, company);
    drawTableRow(doc, [
      { value: c.product?.code || '', x: cols[0].x, width: cols[0].width },
      { value: (c.product?.name || '').slice(0, 35), x: cols[1].x, width: cols[1].width },
      { value: `${c.priceRetailOld.toFixed(2)} ₴`, x: cols[2].x, width: cols[2].width, align: 'right' },
      { value: `${c.priceRetailNew.toFixed(2)} ₴`, x: cols[3].x, width: cols[3].width, align: 'right' },
      { value: `${c.changePercent > 0 ? '+' : ''}${c.changePercent}%`, x: cols[4].x, width: cols[4].width, align: 'right' },
    ], i);
  }
}

async function renderChannelsReport(doc: PDFKit.PDFDocument, days: number, company: CompanyInfo) {
  const data = await getChannelAnalytics(days);

  drawSectionTitle(doc, 'Аналітика каналів');

  drawSectionTitle(doc, 'За джерелом');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  for (const s of data.bySource) {
    doc.text(`${s.source}: ${s.orders} замовлень, ${s.revenue.toFixed(0)} ₴`, PAGE.margin, doc.y);
  }
  doc.moveDown(1);

  drawSectionTitle(doc, 'UTM Sources');

  const M = PAGE.margin;
  const cols = [
    { label: 'UTM Source', x: M, width: 170 },
    { label: 'Замовлень', x: M + 175, width: 90, align: 'right' as const },
    { label: 'Виручка', x: M + 270, width: 120, align: 'right' as const },
    { label: 'Сер. чек', x: M + 395, width: 120, align: 'right' as const },
  ];

  drawTableHeader(doc, cols);

  for (let i = 0; i < data.byUtmSource.length; i++) {
    const row = data.byUtmSource[i];
    checkPageBreak(doc, company);
    drawTableRow(doc, [
      { value: row.utmSource || 'Без мітки', x: cols[0].x, width: cols[0].width },
      { value: String(row.orders), x: cols[1].x, width: cols[1].width, align: 'right' },
      { value: `${row.revenue.toFixed(0)} ₴`, x: cols[2].x, width: cols[2].width, align: 'right' },
      { value: `${row.orders > 0 ? (row.revenue / row.orders).toFixed(0) : 0} ₴`, x: cols[3].x, width: cols[3].width, align: 'right' },
    ], i);
  }

  doc.moveDown(1);
  drawSectionTitle(doc, 'Конверсія по каналах');

  const convCols = [
    { label: 'Канал', x: M, width: 170 },
    { label: 'Візити', x: M + 175, width: 100, align: 'right' as const },
    { label: 'Конверсії', x: M + 280, width: 100, align: 'right' as const },
    { label: 'Конверсія %', x: M + 385, width: 130, align: 'right' as const },
  ];

  drawTableHeader(doc, convCols);
  for (let i = 0; i < data.channelConversionRates.length; i++) {
    const row = data.channelConversionRates[i];
    checkPageBreak(doc, company);
    drawTableRow(doc, [
      { value: row.source, x: convCols[0].x, width: convCols[0].width },
      { value: String(row.visits), x: convCols[1].x, width: convCols[1].width, align: 'right' },
      { value: String(row.conversions), x: convCols[2].x, width: convCols[2].width, align: 'right' },
      { value: `${row.conversionRate}%`, x: convCols[3].x, width: convCols[3].width, align: 'right' },
    ], i);
  }
}

async function renderGeographyReport(doc: PDFKit.PDFDocument, days: number, company: CompanyInfo) {
  const data = await getGeographyAnalytics(days);

  drawSectionTitle(doc, 'Географія замовлень');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Міст: ${data.totalCities} | Замовлень: ${data.totalOrders} | Виручка: ${data.totalRevenue.toFixed(0)} ₴`, PAGE.margin, doc.y);
  if (data.topCity) doc.text(`Топ-місто: ${data.topCity.city} (${data.topCity.ordersPercent}%)`);
  doc.moveDown(1);

  const M = PAGE.margin;
  const cols = [
    { label: 'Місто', x: M, width: 130 },
    { label: 'Замовлень', x: M + 135, width: 65, align: 'right' as const },
    { label: '% зам.', x: M + 205, width: 55, align: 'right' as const },
    { label: 'Виручка', x: M + 265, width: 90, align: 'right' as const },
    { label: '% вируч.', x: M + 360, width: 60, align: 'right' as const },
    { label: 'Сер. чек', x: M + 425, width: 90, align: 'right' as const },
  ];

  drawTableHeader(doc, cols);

  for (let i = 0; i < Math.min(data.cities.length, 40); i++) {
    const city = data.cities[i];
    checkPageBreak(doc, company);
    drawTableRow(doc, [
      { value: city.city, x: cols[0].x, width: cols[0].width },
      { value: String(city.orders), x: cols[1].x, width: cols[1].width, align: 'right' },
      { value: `${city.ordersPercent}%`, x: cols[2].x, width: cols[2].width, align: 'right' },
      { value: `${city.revenue.toFixed(0)} ₴`, x: cols[3].x, width: cols[3].width, align: 'right' },
      { value: `${city.revenuePercent}%`, x: cols[4].x, width: cols[4].width, align: 'right' },
      { value: `${city.avgCheck} ₴`, x: cols[5].x, width: cols[5].width, align: 'right' },
    ], i);
  }
}

async function renderLTVReport(doc: PDFKit.PDFDocument, days: number, company: CompanyInfo) {
  const data = await getCustomerLTV(days);

  drawSectionTitle(doc, 'Customer Lifetime Value');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Клієнтів: ${data.summary.totalCustomers}`, PAGE.margin, doc.y);
  doc.text(`Загальна виручка: ${data.summary.totalRevenue} ₴`);
  doc.text(`Середній LTV: ${data.summary.avgLTV} ₴ | Медіана: ${data.summary.medianLTV} ₴`);
  doc.moveDown(0.5);

  doc.text('Розподіл:');
  for (const b of data.distribution) {
    doc.text(`  ${b.label}: ${b.count} клієнтів (${b.revenue.toFixed(0)} ₴)`);
  }
  doc.moveDown(1);

  drawSectionTitle(doc, 'Топ клієнтів за LTV');

  const M = PAGE.margin;
  const cols = [
    { label: '#', x: M, width: 25 },
    { label: 'Клієнт', x: M + 30, width: 180 },
    { label: 'Витрачено', x: M + 215, width: 80, align: 'right' as const },
    { label: 'Замовл.', x: M + 300, width: 55, align: 'right' as const },
    { label: 'Сер. чек', x: M + 360, width: 70, align: 'right' as const },
    { label: 'Річний LTV', x: M + 435, width: 80, align: 'right' as const },
  ];

  drawTableHeader(doc, cols);

  for (let i = 0; i < Math.min(data.topCustomers.length, 30); i++) {
    const c = data.topCustomers[i];
    checkPageBreak(doc, company);
    drawTableRow(doc, [
      { value: String(i + 1), x: cols[0].x, width: cols[0].width },
      { value: (c.fullName || c.email).slice(0, 30), x: cols[1].x, width: cols[1].width },
      { value: `${c.totalSpent.toFixed(0)} ₴`, x: cols[2].x, width: cols[2].width, align: 'right' },
      { value: String(c.orderCount), x: cols[3].x, width: cols[3].width, align: 'right' },
      { value: `${c.avgCheck} ₴`, x: cols[4].x, width: cols[4].width, align: 'right' },
      { value: `${c.projectedYearlyLTV} ₴`, x: cols[5].x, width: cols[5].width, align: 'right' },
    ], i);
  }
}

async function renderSegmentsReport(doc: PDFKit.PDFDocument, company: CompanyInfo) {
  const data = await getCustomerSegmentation();

  drawSectionTitle(doc, 'Сегментація клієнтів');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Всього клієнтів: ${data.totalCustomers} | Загальна виручка: ${data.totalRevenue} ₴`, PAGE.margin, doc.y);
  doc.moveDown(1);

  const M = PAGE.margin;
  const cols = [
    { label: 'Сегмент', x: M, width: 140 },
    { label: 'Клієнтів', x: M + 145, width: 75, align: 'right' as const },
    { label: '% від загальної', x: M + 225, width: 90, align: 'right' as const },
    { label: 'Виручка', x: M + 320, width: 95, align: 'right' as const },
    { label: 'Сер. чек', x: M + 420, width: 95, align: 'right' as const },
  ];

  drawTableHeader(doc, cols);

  for (let i = 0; i < data.segments.length; i++) {
    const seg = data.segments[i];
    checkPageBreak(doc, company);
    const pct = data.totalCustomers > 0 ? ((seg.count / data.totalCustomers) * 100).toFixed(1) : '0';
    drawTableRow(doc, [
      { value: seg.label, x: cols[0].x, width: cols[0].width },
      { value: String(seg.count), x: cols[1].x, width: cols[1].width, align: 'right' },
      { value: `${pct}%`, x: cols[2].x, width: cols[2].width, align: 'right' },
      { value: `${seg.revenue} ₴`, x: cols[3].x, width: cols[3].width, align: 'right' },
      { value: `${seg.avgCheck} ₴`, x: cols[4].x, width: cols[4].width, align: 'right' },
    ], i, 18);
  }
}

async function renderSummaryReport(doc: PDFKit.PDFDocument, days: number, company: CompanyInfo) {
  // Stock summary
  const stock = await getStockAnalytics(days);
  drawSectionTitle(doc, 'Залишки');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Активних товарів: ${stock.summary.totalProducts}`, PAGE.margin, doc.y);
  doc.text(`Критичний запас: ${stock.summary.criticalCount}`);
  doc.text(`Dead stock: ${stock.summary.deadStockCount}`);
  doc.moveDown(1);

  checkPageBreak(doc, company);

  // Geography summary
  const geo = await getGeographyAnalytics(days);
  drawSectionTitle(doc, 'Географія');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Міст: ${geo.totalCities} | Замовлень: ${geo.totalOrders} | Виручка: ${geo.totalRevenue.toFixed(0)} ₴`, PAGE.margin, doc.y);
  if (geo.topCity) doc.text(`Топ-місто: ${geo.topCity.city}`);
  doc.moveDown(1);

  checkPageBreak(doc, company);

  // LTV summary
  const ltv = await getCustomerLTV(days);
  drawSectionTitle(doc, 'Customer LTV');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  doc.text(`Клієнтів: ${ltv.summary.totalCustomers}`, PAGE.margin, doc.y);
  doc.text(`Середній LTV: ${ltv.summary.avgLTV} ₴ | Медіана: ${ltv.summary.medianLTV} ₴`);
  doc.moveDown(1);

  checkPageBreak(doc, company);

  // Segments summary
  const segs = await getCustomerSegmentation();
  drawSectionTitle(doc, 'Сегменти');
  doc.font('Regular').fontSize(10).fillColor(BRAND.text);
  for (const seg of segs.segments) {
    const pct = segs.totalCustomers > 0 ? ((seg.count / segs.totalCustomers) * 100).toFixed(1) : '0';
    doc.text(`${seg.label}: ${seg.count} (${pct}%) — ${seg.revenue} ₴`, PAGE.margin, doc.y);
  }
}
