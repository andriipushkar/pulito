import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import {
  getStockAnalytics,
  getPriceAnalytics,
  getChannelAnalytics,
  getGeographyAnalytics,
  getCustomerLTV,
  getCustomerSegmentation,
} from './analytics-reports';

const FONT_PATH = path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf');

const COMPANY = {
  name: 'Порошок',
  description: 'Аналітичний звіт',
};

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

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).text(COMPANY.name, { align: 'center' });
  doc.fontSize(10).text(COMPANY.description, { align: 'center' });
  doc.moveDown(1);

  const dateRange = `Період: ${days} днів (до ${new Date().toLocaleDateString('uk-UA')})`;
  doc.fontSize(10).text(dateRange, { align: 'center' });
  doc.moveDown(1.5);

  switch (reportType) {
    case 'stock':
      await renderStockReport(doc, days);
      break;
    case 'price':
      await renderPriceReport(doc, days);
      break;
    case 'channels':
      await renderChannelsReport(doc, days);
      break;
    case 'geography':
      await renderGeographyReport(doc, days);
      break;
    case 'ltv':
      await renderLTVReport(doc, days);
      break;
    case 'segments':
      await renderSegmentsReport(doc);
      break;
    case 'summary':
      await renderSummaryReport(doc, days);
      break;
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: { label: string; x: number; width: number; align?: string }[], y: number) {
  doc.fontSize(8).fillColor('#444444');
  for (const col of columns) {
    doc.text(col.label, col.x, y, { width: col.width, align: (col.align as 'left' | 'right' | 'center') || 'left' });
  }
  doc.moveTo(50, y + 14).lineTo(545, y + 14).stroke('#cccccc');
  doc.fillColor('#000000');
  return y + 22;
}

function checkPage(doc: PDFKit.PDFDocument, y: number): number {
  if (y > 720) {
    doc.addPage();
    return 50;
  }
  return y;
}

async function renderStockReport(doc: PDFKit.PDFDocument, days: number) {
  const data = await getStockAnalytics(days);

  doc.fontSize(14).text('Аналітика залишків');
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Активних товарів: ${data.summary.totalProducts}`);
  doc.text(`Критичний запас: ${data.summary.criticalCount}`);
  doc.text(`Dead stock (60+ днів): ${data.summary.deadStockCount}`);
  doc.text(`Середня оборотність: ${data.summary.avgTurnover}`);
  doc.moveDown(1);

  // Critical stock table
  doc.fontSize(12).text('Критичні залишки (< 14 днів)');
  doc.moveDown(0.5);

  const cols = [
    { label: 'Код', x: 50, width: 80 },
    { label: 'Назва', x: 135, width: 200 },
    { label: 'Залишок', x: 340, width: 60, align: 'right' },
    { label: 'Прод./день', x: 405, width: 65, align: 'right' },
    { label: 'Днів до 0', x: 475, width: 65, align: 'right' },
  ];

  let y = drawTableHeader(doc, cols, doc.y);

  for (const item of data.criticalStock.slice(0, 30)) {
    y = checkPage(doc, y);
    doc.fontSize(7);
    doc.text(item.code, cols[0].x, y, { width: cols[0].width });
    doc.text(item.name.slice(0, 40), cols[1].x, y, { width: cols[1].width });
    doc.text(String(item.quantity), cols[2].x, y, { width: cols[2].width, align: 'right' });
    doc.text(String(item.avgDailySales), cols[3].x, y, { width: cols[3].width, align: 'right' });
    doc.text(item.daysUntilOut !== null ? String(item.daysUntilOut) : '—', cols[4].x, y, { width: cols[4].width, align: 'right' });
    y += 16;
  }
}

async function renderPriceReport(doc: PDFKit.PDFDocument, days: number) {
  const data = await getPriceAnalytics(days);

  doc.fontSize(14).text('Аналітика цін');
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Змін цін: ${data.summary.totalChanges}`);
  doc.text(`Підвищення: ${data.summary.priceIncreases} | Зниження: ${data.summary.priceDecreases}`);
  doc.text(`Середня зміна: ${data.summary.avgChangePercent}%`);
  doc.moveDown(1);

  doc.fontSize(12).text('Останні зміни цін');
  doc.moveDown(0.5);

  const cols = [
    { label: 'Код', x: 50, width: 70 },
    { label: 'Назва', x: 125, width: 170 },
    { label: 'Стара ціна', x: 300, width: 70, align: 'right' },
    { label: 'Нова ціна', x: 375, width: 70, align: 'right' },
    { label: 'Зміна %', x: 450, width: 90, align: 'right' },
  ];

  let y = drawTableHeader(doc, cols, doc.y);

  for (const c of data.changes.slice(0, 40)) {
    y = checkPage(doc, y);
    doc.fontSize(7);
    doc.text(c.product?.code || '', cols[0].x, y, { width: cols[0].width });
    doc.text((c.product?.name || '').slice(0, 35), cols[1].x, y, { width: cols[1].width });
    doc.text(`${c.priceRetailOld.toFixed(2)} ₴`, cols[2].x, y, { width: cols[2].width, align: 'right' });
    doc.text(`${c.priceRetailNew.toFixed(2)} ₴`, cols[3].x, y, { width: cols[3].width, align: 'right' });
    doc.text(`${c.changePercent > 0 ? '+' : ''}${c.changePercent}%`, cols[4].x, y, { width: cols[4].width, align: 'right' });
    y += 16;
  }
}

async function renderChannelsReport(doc: PDFKit.PDFDocument, days: number) {
  const data = await getChannelAnalytics(days);

  doc.fontSize(14).text('Аналітика каналів');
  doc.moveDown(0.5);

  doc.fontSize(12).text('За джерелом');
  doc.moveDown(0.5);
  doc.fontSize(10);
  for (const s of data.bySource) {
    doc.text(`${s.source}: ${s.orders} замовлень, ${s.revenue.toFixed(0)} ₴`);
  }
  doc.moveDown(1);

  doc.fontSize(12).text('UTM Sources');
  doc.moveDown(0.5);

  const cols = [
    { label: 'UTM Source', x: 50, width: 150 },
    { label: 'Замовлень', x: 210, width: 80, align: 'right' },
    { label: 'Виручка', x: 300, width: 100, align: 'right' },
    { label: 'Сер. чек', x: 410, width: 100, align: 'right' },
  ];

  let y = drawTableHeader(doc, cols, doc.y);

  for (const row of data.byUtmSource) {
    y = checkPage(doc, y);
    doc.fontSize(7);
    doc.text(row.utmSource || 'Без мітки', cols[0].x, y, { width: cols[0].width });
    doc.text(String(row.orders), cols[1].x, y, { width: cols[1].width, align: 'right' });
    doc.text(`${row.revenue.toFixed(0)} ₴`, cols[2].x, y, { width: cols[2].width, align: 'right' });
    doc.text(`${row.orders > 0 ? (row.revenue / row.orders).toFixed(0) : 0} ₴`, cols[3].x, y, { width: cols[3].width, align: 'right' });
    y += 16;
  }

  doc.moveDown(1);
  doc.fontSize(12).text('Конверсія по каналах');
  doc.moveDown(0.5);

  const convCols = [
    { label: 'Канал', x: 50, width: 150 },
    { label: 'Візити', x: 210, width: 80, align: 'right' },
    { label: 'Конверсії', x: 300, width: 80, align: 'right' },
    { label: 'Конверсія %', x: 390, width: 100, align: 'right' },
  ];

  y = drawTableHeader(doc, convCols, doc.y);
  for (const row of data.channelConversionRates) {
    y = checkPage(doc, y);
    doc.fontSize(7);
    doc.text(row.source, convCols[0].x, y, { width: convCols[0].width });
    doc.text(String(row.visits), convCols[1].x, y, { width: convCols[1].width, align: 'right' });
    doc.text(String(row.conversions), convCols[2].x, y, { width: convCols[2].width, align: 'right' });
    doc.text(`${row.conversionRate}%`, convCols[3].x, y, { width: convCols[3].width, align: 'right' });
    y += 16;
  }
}

async function renderGeographyReport(doc: PDFKit.PDFDocument, days: number) {
  const data = await getGeographyAnalytics(days);

  doc.fontSize(14).text('Географія замовлень');
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Міст: ${data.totalCities} | Замовлень: ${data.totalOrders} | Виручка: ${data.totalRevenue.toFixed(0)} ₴`);
  if (data.topCity) doc.text(`Топ-місто: ${data.topCity.city} (${data.topCity.ordersPercent}%)`);
  doc.moveDown(1);

  const cols = [
    { label: 'Місто', x: 50, width: 140 },
    { label: 'Замовлень', x: 195, width: 65, align: 'right' },
    { label: '% зам.', x: 265, width: 55, align: 'right' },
    { label: 'Виручка', x: 325, width: 80, align: 'right' },
    { label: '% вируч.', x: 410, width: 55, align: 'right' },
    { label: 'Сер. чек', x: 470, width: 70, align: 'right' },
  ];

  let y = drawTableHeader(doc, cols, doc.y);

  for (const city of data.cities.slice(0, 40)) {
    y = checkPage(doc, y);
    doc.fontSize(7);
    doc.text(city.city, cols[0].x, y, { width: cols[0].width });
    doc.text(String(city.orders), cols[1].x, y, { width: cols[1].width, align: 'right' });
    doc.text(`${city.ordersPercent}%`, cols[2].x, y, { width: cols[2].width, align: 'right' });
    doc.text(`${city.revenue.toFixed(0)} ₴`, cols[3].x, y, { width: cols[3].width, align: 'right' });
    doc.text(`${city.revenuePercent}%`, cols[4].x, y, { width: cols[4].width, align: 'right' });
    doc.text(`${city.avgCheck} ₴`, cols[5].x, y, { width: cols[5].width, align: 'right' });
    y += 16;
  }
}

async function renderLTVReport(doc: PDFKit.PDFDocument, days: number) {
  const data = await getCustomerLTV(days);

  doc.fontSize(14).text('Customer Lifetime Value');
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Клієнтів: ${data.summary.totalCustomers}`);
  doc.text(`Загальна виручка: ${data.summary.totalRevenue} ₴`);
  doc.text(`Середній LTV: ${data.summary.avgLTV} ₴ | Медіана: ${data.summary.medianLTV} ₴`);
  doc.moveDown(0.5);

  doc.text('Розподіл:');
  for (const b of data.distribution) {
    doc.text(`  ${b.label}: ${b.count} клієнтів (${b.revenue.toFixed(0)} ₴)`);
  }
  doc.moveDown(1);

  doc.fontSize(12).text('Топ клієнтів за LTV');
  doc.moveDown(0.5);

  const cols = [
    { label: '#', x: 50, width: 20 },
    { label: 'Клієнт', x: 75, width: 160 },
    { label: 'Витрачено', x: 240, width: 75, align: 'right' },
    { label: 'Замовл.', x: 320, width: 50, align: 'right' },
    { label: 'Сер. чек', x: 375, width: 60, align: 'right' },
    { label: 'Річний LTV', x: 440, width: 100, align: 'right' },
  ];

  let y = drawTableHeader(doc, cols, doc.y);

  for (let i = 0; i < Math.min(data.topCustomers.length, 30); i++) {
    const c = data.topCustomers[i];
    y = checkPage(doc, y);
    doc.fontSize(7);
    doc.text(String(i + 1), cols[0].x, y, { width: cols[0].width });
    doc.text((c.fullName || c.email).slice(0, 30), cols[1].x, y, { width: cols[1].width });
    doc.text(`${c.totalSpent.toFixed(0)} ₴`, cols[2].x, y, { width: cols[2].width, align: 'right' });
    doc.text(String(c.orderCount), cols[3].x, y, { width: cols[3].width, align: 'right' });
    doc.text(`${c.avgCheck} ₴`, cols[4].x, y, { width: cols[4].width, align: 'right' });
    doc.text(`${c.projectedYearlyLTV} ₴`, cols[5].x, y, { width: cols[5].width, align: 'right' });
    y += 16;
  }
}

async function renderSegmentsReport(doc: PDFKit.PDFDocument) {
  const data = await getCustomerSegmentation();

  doc.fontSize(14).text('Сегментація клієнтів');
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Всього клієнтів: ${data.totalCustomers} | Загальна виручка: ${data.totalRevenue} ₴`);
  doc.moveDown(1);

  const cols = [
    { label: 'Сегмент', x: 50, width: 120 },
    { label: 'Клієнтів', x: 175, width: 65, align: 'right' },
    { label: '% від загальної', x: 245, width: 85, align: 'right' },
    { label: 'Виручка', x: 335, width: 80, align: 'right' },
    { label: 'Сер. чек', x: 420, width: 80, align: 'right' },
  ];

  let y = drawTableHeader(doc, cols, doc.y);

  for (const seg of data.segments) {
    y = checkPage(doc, y);
    const pct = data.totalCustomers > 0 ? ((seg.count / data.totalCustomers) * 100).toFixed(1) : '0';
    doc.fontSize(8);
    doc.text(seg.label, cols[0].x, y, { width: cols[0].width });
    doc.text(String(seg.count), cols[1].x, y, { width: cols[1].width, align: 'right' });
    doc.text(`${pct}%`, cols[2].x, y, { width: cols[2].width, align: 'right' });
    doc.text(`${seg.revenue} ₴`, cols[3].x, y, { width: cols[3].width, align: 'right' });
    doc.text(`${seg.avgCheck} ₴`, cols[4].x, y, { width: cols[4].width, align: 'right' });
    y += 18;
  }
}

async function renderSummaryReport(doc: PDFKit.PDFDocument, days: number) {
  doc.fontSize(14).text('Загальний звіт');
  doc.moveDown(1);

  // Stock summary
  const stock = await getStockAnalytics(days);
  doc.fontSize(12).text('Залишки');
  doc.fontSize(10);
  doc.text(`Активних товарів: ${stock.summary.totalProducts}`);
  doc.text(`Критичний запас: ${stock.summary.criticalCount}`);
  doc.text(`Dead stock: ${stock.summary.deadStockCount}`);
  doc.moveDown(1);

  // Geography summary
  const geo = await getGeographyAnalytics(days);
  doc.fontSize(12).text('Географія');
  doc.fontSize(10);
  doc.text(`Міст: ${geo.totalCities} | Замовлень: ${geo.totalOrders} | Виручка: ${geo.totalRevenue.toFixed(0)} ₴`);
  if (geo.topCity) doc.text(`Топ-місто: ${geo.topCity.city}`);
  doc.moveDown(1);

  // LTV summary
  const ltv = await getCustomerLTV(days);
  doc.fontSize(12).text('Customer LTV');
  doc.fontSize(10);
  doc.text(`Клієнтів: ${ltv.summary.totalCustomers}`);
  doc.text(`Середній LTV: ${ltv.summary.avgLTV} ₴ | Медіана: ${ltv.summary.medianLTV} ₴`);
  doc.moveDown(1);

  // Segments summary
  const segs = await getCustomerSegmentation();
  doc.fontSize(12).text('Сегменти');
  doc.fontSize(10);
  for (const seg of segs.segments) {
    const pct = segs.totalCustomers > 0 ? ((seg.count / segs.totalCustomers) * 100).toFixed(1) : '0';
    doc.text(`${seg.label}: ${seg.count} (${pct}%) — ${seg.revenue} ₴`);
  }
}
