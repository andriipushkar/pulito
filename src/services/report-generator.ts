import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import type { Prisma } from '../../generated/prisma';

const FONT_PATH = path.join(process.cwd(), 'src/assets/fonts/Roboto-Regular.ttf');

type TemplateKey =
  | 'sales_summary'
  | 'products_stock'
  | 'orders_by_status'
  | 'clients_activity'
  | 'wholesale_report'
  | 'delivery_report'
  | 'financial_report'
  | 'returns_cancellations'
  | 'wholesale_groups'
  | 'product_leaders'
  | 'manager_activity'
  | 'acquisition_channels'
  | 'summary_report'
  | 'custom';

type Format = 'xlsx' | 'csv' | 'pdf';

interface ReportParams {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  entity?: string;
  fields?: string[];
  filters?: Record<string, unknown>;
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  sales_summary: 'Звіт про продажі',
  products_stock: 'Залишки товарів',
  orders_by_status: 'Замовлення за статусом',
  clients_activity: 'Активність клієнтів',
  wholesale_report: 'Оптові продажі',
  delivery_report: 'Звіт по доставках',
  financial_report: 'Фінансовий звіт',
  returns_cancellations: 'Повернення та скасування',
  wholesale_groups: 'Звіт по оптових групах',
  product_leaders: 'Товари-лідери та аутсайдери',
  manager_activity: 'Активність менеджерів',
  acquisition_channels: 'Канали залучення',
  summary_report: 'Зведений звіт',
  custom: 'Власний звіт',
};

// ── Main entry point ──

export async function generateReport(
  templateKey: TemplateKey,
  format: Format,
  params: ReportParams
): Promise<{ url: string }> {
  const reportsDir = path.join(env.UPLOAD_DIR, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `${templateKey}_${timestamp}.${format === 'pdf' ? 'pdf' : format}`;
  const filePath = path.join(reportsDir, fileName);
  const publicUrl = `/uploads/reports/${fileName}`;

  const fetchFn = DATA_FETCHERS[templateKey];
  const rows = await fetchFn(params);

  if (format === 'pdf') {
    const config = PDF_CONFIGS[templateKey];
    await renderPdf(rows, config.title, config.columns, filePath);
  } else {
    const sheetName = TEMPLATE_LABELS[templateKey];
    if (format === 'csv') {
      renderCsv(rows, filePath);
    } else {
      renderXlsx(rows, sheetName, filePath);
    }
  }

  return { url: publicUrl };
}

// ── Date helpers ──

function buildDateRange(params: ReportParams): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (params.dateFrom) range.gte = new Date(params.dateFrom);
  if (params.dateTo) {
    const d = new Date(params.dateTo);
    d.setHours(23, 59, 59, 999);
    range.lte = d;
  }
  return range;
}

// ── Data fetchers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>;

async function fetchSalesSummary(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = {
    status: { notIn: ['cancelled', 'returned'] },
  };
  if (dateRange.gte || dateRange.lte) {
    where.createdAt = dateRange;
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      createdAt: true,
      totalAmount: true,
      itemsCount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = new Map<string, { revenue: number; count: number; items: number }>();
  for (const o of orders) {
    const dateKey = o.createdAt.toLocaleDateString('uk-UA');
    const existing = grouped.get(dateKey) || { revenue: 0, count: 0, items: 0 };
    existing.revenue += Number(o.totalAmount);
    existing.count += 1;
    existing.items += o.itemsCount;
    grouped.set(dateKey, existing);
  }

  return Array.from(grouped.entries()).map(([date, data]) => ({
    'Дата': date,
    'Замовлень': data.count,
    'Товарів': data.items,
    'Виручка': Number(data.revenue.toFixed(2)),
    'Середній чек': Number((data.count > 0 ? data.revenue / data.count : 0).toFixed(2)),
  }));
}

async function fetchProductsStock(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      code: true,
      name: true,
      quantity: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
      category: { select: { name: true } },
      _count: {
        select: {
          orderItems: dateRange.gte || dateRange.lte
            ? { where: { order: { createdAt: dateRange, status: { notIn: ['cancelled', 'returned'] } } } }
            : { where: { order: { status: { notIn: ['cancelled', 'returned'] } } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    'Код': p.code,
    'Назва': p.name,
    'Категорія': p.category?.name || '',
    'Залишок': p.quantity,
    'Роздрібна ціна': Number(Number(p.priceRetail).toFixed(2)),
    'Оптова ціна': Number(Number(p.priceWholesale || 0).toFixed(2)),
    'Продано (шт)': p._count.orderItems,
  }));
}

async function fetchOrdersByStatus(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = {};
  if (params.status) where.status = params.status as Prisma.EnumOrderStatusFilter;
  if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { select: { productName: true, quantity: true, subtotal: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    '№ замовлення': o.orderNumber,
    'Дата': o.createdAt.toLocaleDateString('uk-UA'),
    'Статус': o.status,
    'Клієнт': o.contactName,
    'Телефон': o.contactPhone,
    'Тип': o.clientType === 'wholesale' ? 'Оптовий' : 'Роздрібний',
    'Кількість товарів': o.itemsCount,
    'Сума': Number(Number(o.totalAmount).toFixed(2)),
    'Оплата': o.paymentMethod,
    'Статус оплати': o.paymentStatus,
    'Товари': o.items.map((i) => `${i.productName} x${i.quantity}`).join('; '),
  }));
}

async function fetchClientsActivity(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          orders: dateRange.gte || dateRange.lte
            ? { where: { createdAt: dateRange } }
            : true,
        },
      },
      orders: {
        where: dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {},
        select: { totalAmount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((u) => {
    const totalSpent = u.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    return {
      'ID': u.id,
      'Email': u.email,
      "Ім'я": u.fullName || '',
      'Телефон': u.phone || '',
      'Роль': u.role,
      'Дата реєстрації': u.createdAt.toLocaleDateString('uk-UA'),
      'Замовлень за період': u._count.orders,
      'Сума за період': Number(totalSpent.toFixed(2)),
    };
  });
}

async function fetchWholesaleReport(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = {
    clientType: 'wholesale',
  };
  if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { fullName: true, companyName: true, edrpou: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    '№ замовлення': o.orderNumber,
    'Дата': o.createdAt.toLocaleDateString('uk-UA'),
    'Клієнт': o.contactName,
    'Компанія': o.user?.companyName || '',
    'ЄДРПОУ': o.user?.edrpou || '',
    'Статус': o.status,
    'Кількість товарів': o.itemsCount,
    'Знижка': Number(Number(o.discountAmount).toFixed(2)),
    'Сума': Number(Number(o.totalAmount).toFixed(2)),
    'Оплата': o.paymentMethod,
    'Статус оплати': o.paymentStatus,
  }));
}

async function fetchDeliveryReport(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = {};
  if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

  const orders = await prisma.order.findMany({
    where,
    select: {
      orderNumber: true,
      createdAt: true,
      deliveryMethod: true,
      deliveryCity: true,
      deliveryAddress: true,
      trackingNumber: true,
      deliveryCost: true,
      status: true,
      contactName: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    '№ замовлення': o.orderNumber,
    'Дата': o.createdAt.toLocaleDateString('uk-UA'),
    'Клієнт': o.contactName,
    'Метод доставки': o.deliveryMethod,
    'Місто': o.deliveryCity || '',
    'Адреса': o.deliveryAddress || '',
    'ТТН': o.trackingNumber || '',
    'Вартість доставки': Number(Number(o.deliveryCost).toFixed(2)),
    'Статус замовлення': o.status,
  }));
}

// ── New report fetchers ──

async function fetchFinancialReport(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = { status: { notIn: ['cancelled', 'returned'] } };
  if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

  const orders = await prisma.order.findMany({
    where,
    select: { createdAt: true, totalAmount: true, discountAmount: true, deliveryCost: true },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = new Map<string, { revenue: number; discounts: number; delivery: number; count: number }>();
  for (const o of orders) {
    const dateKey = o.createdAt.toLocaleDateString('uk-UA');
    const existing = grouped.get(dateKey) || { revenue: 0, discounts: 0, delivery: 0, count: 0 };
    existing.revenue += Number(o.totalAmount);
    existing.discounts += Number(o.discountAmount);
    existing.delivery += Number(o.deliveryCost);
    existing.count += 1;
    grouped.set(dateKey, existing);
  }

  return Array.from(grouped.entries()).map(([date, d]) => ({
    'Дата': date,
    'Замовлень': d.count,
    'Виручка': Number(d.revenue.toFixed(2)),
    'Знижки': Number(d.discounts.toFixed(2)),
    'Доставка': Number(d.delivery.toFixed(2)),
    'Чистий дохід': Number((d.revenue - d.discounts - d.delivery).toFixed(2)),
    'Середній чек': Number((d.count > 0 ? d.revenue / d.count : 0).toFixed(2)),
  }));
}

async function fetchReturnsCancellations(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = { status: { in: ['cancelled', 'returned'] } };
  if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

  const orders = await prisma.order.findMany({
    where,
    select: {
      orderNumber: true, createdAt: true, status: true, totalAmount: true,
      cancelledReason: true, cancelledBy: true, contactName: true, itemsCount: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    '№ замовлення': o.orderNumber,
    'Дата': o.createdAt.toLocaleDateString('uk-UA'),
    'Статус': o.status === 'cancelled' ? 'Скасовано' : 'Повернуто',
    'Клієнт': o.contactName,
    'Товарів': o.itemsCount,
    'Сума': Number(Number(o.totalAmount).toFixed(2)),
    'Причина': o.cancelledReason || 'Не вказано',
    'Ініціатор': o.cancelledBy || 'Не вказано',
  }));
}

async function fetchWholesaleGroups(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const orderWhere: Prisma.OrderWhereInput = { status: { notIn: ['cancelled', 'returned'] }, clientType: 'wholesale' };
  if (dateRange.gte || dateRange.lte) orderWhere.createdAt = dateRange;

  const groupLabels: Record<number, string> = { 1: 'Дрібний опт', 2: 'Середній опт', 3: 'Великий опт' };

  const wholesalers = await prisma.user.findMany({
    where: { role: 'wholesaler', wholesaleGroup: { not: null } },
    select: {
      id: true, fullName: true, companyName: true, wholesaleGroup: true,
      orders: {
        where: orderWhere,
        select: { totalAmount: true },
      },
      _count: {
        select: {
          orders: dateRange.gte || dateRange.lte
            ? { where: { ...orderWhere } }
            : { where: { status: { notIn: ['cancelled', 'returned'] }, clientType: 'wholesale' } },
        },
      },
    },
  });

  return wholesalers
    .sort((a, b) => (a.wholesaleGroup || 0) - (b.wholesaleGroup || 0))
    .map((u) => {
      const totalSpent = u.orders.reduce((s, o) => s + Number(o.totalAmount), 0);
      return {
        'Група': groupLabels[u.wholesaleGroup!] || `Група ${u.wholesaleGroup}`,
        "Ім'я": u.fullName,
        'Компанія': u.companyName || '',
        'Замовлень': u._count.orders,
        'Сума': Number(totalSpent.toFixed(2)),
        'Середній чек': Number((u._count.orders > 0 ? totalSpent / u._count.orders : 0).toFixed(2)),
      };
    });
}

async function fetchProductLeaders(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const orderItemWhere: Prisma.OrderItemWhereInput = { order: { status: { notIn: ['cancelled', 'returned'] } } };
  if (dateRange.gte || dateRange.lte) {
    orderItemWhere.order = { ...orderItemWhere.order as object, createdAt: dateRange };
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      code: true, name: true, priceRetail: true, quantity: true, viewsCount: true,
      category: { select: { name: true } },
      _count: {
        select: { orderItems: { where: orderItemWhere } },
      },
      orderItems: {
        where: orderItemWhere,
        select: { quantity: true, subtotal: true },
      },
    },
  });

  return products
    .map((p) => {
      const soldQty = p.orderItems.reduce((s, i) => s + i.quantity, 0);
      const soldSum = p.orderItems.reduce((s, i) => s + Number(i.subtotal), 0);
      return {
        'Код': p.code,
        'Назва': p.name,
        'Категорія': p.category?.name || '',
        'Ціна': Number(Number(p.priceRetail).toFixed(2)),
        'Залишок': p.quantity,
        'Продано (шт)': soldQty,
        'Продано (грн)': Number(soldSum.toFixed(2)),
        'Перегляди': p.viewsCount,
        'Конверсія %': p.viewsCount > 0 ? Number(((soldQty / p.viewsCount) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b['Продано (шт)'] - a['Продано (шт)']);
}

async function fetchManagerActivity(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const historyWhere: Prisma.OrderStatusHistoryWhereInput = { changedBy: { not: null } };
  if (dateRange.gte || dateRange.lte) historyWhere.createdAt = dateRange;

  const statusChanges = await prisma.orderStatusHistory.findMany({
    where: historyWhere,
    select: { changedBy: true, orderId: true, newStatus: true, createdAt: true },
  });

  const managers = await prisma.user.findMany({
    where: { role: { in: ['admin', 'manager'] } },
    select: { id: true, fullName: true, email: true },
  });
  const managerMap = new Map(managers.map((m) => [m.id, m]));

  const stats = new Map<number, { orders: Set<number>; actions: number; statuses: Record<string, number> }>();
  for (const sc of statusChanges) {
    if (!sc.changedBy) continue;
    const existing = stats.get(sc.changedBy) || { orders: new Set(), actions: 0, statuses: {} };
    existing.orders.add(sc.orderId);
    existing.actions += 1;
    existing.statuses[sc.newStatus] = (existing.statuses[sc.newStatus] || 0) + 1;
    stats.set(sc.changedBy, existing);
  }

  return Array.from(stats.entries())
    .map(([managerId, s]) => {
      const mgr = managerMap.get(managerId);
      return {
        'Менеджер': mgr?.fullName || `ID ${managerId}`,
        'Email': mgr?.email || '',
        'Оброблено замовлень': s.orders.size,
        'Дій всього': s.actions,
        'Підтверджено': s.statuses['confirmed'] || 0,
        'Відправлено': s.statuses['shipped'] || 0,
        'Завершено': s.statuses['completed'] || 0,
        'Скасовано': s.statuses['cancelled'] || 0,
      };
    })
    .sort((a, b) => b['Оброблено замовлень'] - a['Оброблено замовлень']);
}

async function fetchAcquisitionChannels(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const where: Prisma.OrderWhereInput = {};
  if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;

  const orders = await prisma.order.findMany({
    where,
    select: { utmSource: true, utmMedium: true, utmCampaign: true, totalAmount: true, status: true },
  });

  const channels = new Map<string, { orders: number; revenue: number; cancelled: number }>();
  for (const o of orders) {
    const source = o.utmSource || 'Прямий трафік';
    const existing = channels.get(source) || { orders: 0, revenue: 0, cancelled: 0 };
    existing.orders += 1;
    if (o.status !== 'cancelled' && o.status !== 'returned') {
      existing.revenue += Number(o.totalAmount);
    }
    if (o.status === 'cancelled') existing.cancelled += 1;
    channels.set(source, existing);
  }

  return Array.from(channels.entries())
    .map(([source, d]) => ({
      'Джерело': source,
      'Замовлень': d.orders,
      'Виручка': Number(d.revenue.toFixed(2)),
      'Скасовано': d.cancelled,
      'Конверсія %': d.orders > 0 ? Number((((d.orders - d.cancelled) / d.orders) * 100).toFixed(1)) : 0,
      'Середній чек': d.orders - d.cancelled > 0 ? Number((d.revenue / (d.orders - d.cancelled)).toFixed(2)) : 0,
    }))
    .sort((a, b) => b['Виручка'] - a['Виручка']);
}

async function fetchSummaryReport(params: ReportParams): Promise<RowData[]> {
  const dateRange = buildDateRange(params);
  const orderWhere: Prisma.OrderWhereInput = {};
  if (dateRange.gte || dateRange.lte) orderWhere.createdAt = dateRange;

  const [
    totalOrders, cancelledOrders, returnedOrders,
    revenueAgg, discountAgg, deliveryAgg,
    newUsers, wholesalers, totalProducts, outOfStock,
  ] = await Promise.all([
    prisma.order.count({ where: { ...orderWhere, status: { notIn: ['cancelled', 'returned'] } } }),
    prisma.order.count({ where: { ...orderWhere, status: 'cancelled' } }),
    prisma.order.count({ where: { ...orderWhere, status: 'returned' } }),
    prisma.order.aggregate({ where: { ...orderWhere, status: { notIn: ['cancelled', 'returned'] } }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { ...orderWhere, status: { notIn: ['cancelled', 'returned'] } }, _sum: { discountAmount: true } }),
    prisma.order.aggregate({ where: { ...orderWhere, status: { notIn: ['cancelled', 'returned'] } }, _sum: { deliveryCost: true } }),
    prisma.user.count({ where: dateRange.gte || dateRange.lte ? { createdAt: dateRange } : {} }),
    prisma.user.count({ where: { role: 'wholesaler' } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, quantity: 0 } }),
  ]);

  const revenue = Number(revenueAgg._sum.totalAmount) || 0;
  const discounts = Number(discountAgg._sum.discountAmount) || 0;
  const delivery = Number(deliveryAgg._sum.deliveryCost) || 0;
  const avgCheck = totalOrders > 0 ? revenue / totalOrders : 0;

  return [
    { 'Показник': 'Виручка', 'Значення': Number(revenue.toFixed(2)) },
    { 'Показник': 'Знижки', 'Значення': Number(discounts.toFixed(2)) },
    { 'Показник': 'Доставка', 'Значення': Number(delivery.toFixed(2)) },
    { 'Показник': 'Чистий дохід', 'Значення': Number((revenue - discounts - delivery).toFixed(2)) },
    { 'Показник': 'Замовлень (без скасованих)', 'Значення': totalOrders },
    { 'Показник': 'Скасовано', 'Значення': cancelledOrders },
    { 'Показник': 'Повернуто', 'Значення': returnedOrders },
    { 'Показник': 'Середній чек', 'Значення': Number(avgCheck.toFixed(2)) },
    { 'Показник': 'Нових користувачів', 'Значення': newUsers },
    { 'Показник': 'Оптових клієнтів', 'Значення': wholesalers },
    { 'Показник': 'Активних товарів', 'Значення': totalProducts },
    { 'Показник': 'Немає в наявності', 'Значення': outOfStock },
  ];
}

const DATA_FETCHERS: Record<TemplateKey, (params: ReportParams) => Promise<RowData[]>> = {
  sales_summary: fetchSalesSummary,
  products_stock: fetchProductsStock,
  orders_by_status: fetchOrdersByStatus,
  clients_activity: fetchClientsActivity,
  wholesale_report: fetchWholesaleReport,
  delivery_report: fetchDeliveryReport,
  financial_report: fetchFinancialReport,
  returns_cancellations: fetchReturnsCancellations,
  wholesale_groups: fetchWholesaleGroups,
  product_leaders: fetchProductLeaders,
  manager_activity: fetchManagerActivity,
  acquisition_channels: fetchAcquisitionChannels,
  summary_report: fetchSummaryReport,
  custom: async (params: ReportParams) => {
    // Custom report - fetch data based on entity param
    const entity = params.entity || 'products';
    if (entity === 'orders') return fetchSalesSummary(params);
    if (entity === 'clients') return fetchClientsActivity(params);
    return fetchProductsStock(params);
  },
};

// ── Renderers ──

function renderXlsx(rows: RowData[], sheetName: string, filePath: string): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  writeFileSync(filePath, buffer);
}

function renderCsv(rows: RowData[], filePath: string): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const csv = XLSX.utils.sheet_to_csv(ws);
  writeFileSync(filePath, csv, 'utf-8');
}

async function renderPdf(
  rows: RowData[],
  title: string,
  columns: { label: string; key: string; width: number; align?: string }[],
  filePath: string
): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
  doc.registerFont('Roboto', FONT_PATH);
  doc.font('Roboto');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc.fontSize(16).text(title, { align: 'center' });
  doc.fontSize(9).text(`Згенеровано: ${new Date().toLocaleDateString('uk-UA')}`, { align: 'center' });
  doc.moveDown(1);

  if (rows.length === 0) {
    doc.fontSize(12).text('Немає даних за обраний період', { align: 'center' });
    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    return;
  }

  // Table
  const startX = 50;
  let currentX = startX;
  let y = doc.y;

  // Header row
  doc.fontSize(8).fillColor('#444444');
  for (const col of columns) {
    doc.text(col.label, currentX, y, {
      width: col.width,
      align: (col.align as 'left' | 'right' | 'center') || 'left',
    });
    currentX += col.width + 5;
  }
  y += 14;
  doc.moveTo(startX, y).lineTo(startX + columns.reduce((s, c) => s + c.width + 5, 0), y).stroke('#cccccc');
  y += 8;
  doc.fillColor('#000000');

  // Data rows
  for (const row of rows) {
    if (y > 520) {
      doc.addPage();
      y = 50;
      // Repeat header
      currentX = startX;
      doc.fontSize(8).fillColor('#444444');
      for (const col of columns) {
        doc.text(col.label, currentX, y, {
          width: col.width,
          align: (col.align as 'left' | 'right' | 'center') || 'left',
        });
        currentX += col.width + 5;
      }
      y += 14;
      doc.moveTo(startX, y).lineTo(startX + columns.reduce((s, c) => s + c.width + 5, 0), y).stroke('#cccccc');
      y += 8;
      doc.fillColor('#000000');
    }

    currentX = startX;
    doc.fontSize(7);
    for (const col of columns) {
      const value = String(row[col.key] ?? '');
      doc.text(value.slice(0, 60), currentX, y, {
        width: col.width,
        align: (col.align as 'left' | 'right' | 'center') || 'left',
      });
      currentX += col.width + 5;
    }
    y += 16;
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// ── PDF column configs ──

interface PdfConfig {
  title: string;
  columns: { label: string; key: string; width: number; align?: string }[];
}

const PDF_CONFIGS: Record<TemplateKey, PdfConfig> = {
  sales_summary: {
    title: 'Звіт про продажі',
    columns: [
      { label: 'Дата', key: 'Дата', width: 100 },
      { label: 'Замовлень', key: 'Замовлень', width: 80, align: 'right' },
      { label: 'Товарів', key: 'Товарів', width: 80, align: 'right' },
      { label: 'Виручка', key: 'Виручка', width: 100, align: 'right' },
      { label: 'Середній чек', key: 'Середній чек', width: 100, align: 'right' },
    ],
  },
  products_stock: {
    title: 'Залишки товарів',
    columns: [
      { label: 'Код', key: 'Код', width: 80 },
      { label: 'Назва', key: 'Назва', width: 200 },
      { label: 'Категорія', key: 'Категорія', width: 120 },
      { label: 'Залишок', key: 'Залишок', width: 60, align: 'right' },
      { label: 'Розд. ціна', key: 'Роздрібна ціна', width: 80, align: 'right' },
      { label: 'Продано', key: 'Продано (шт)', width: 60, align: 'right' },
    ],
  },
  orders_by_status: {
    title: 'Замовлення за статусом',
    columns: [
      { label: '№', key: '№ замовлення', width: 80 },
      { label: 'Дата', key: 'Дата', width: 80 },
      { label: 'Статус', key: 'Статус', width: 80 },
      { label: 'Клієнт', key: 'Клієнт', width: 120 },
      { label: 'Тип', key: 'Тип', width: 70 },
      { label: 'К-ть', key: 'Кількість товарів', width: 40, align: 'right' },
      { label: 'Сума', key: 'Сума', width: 80, align: 'right' },
    ],
  },
  clients_activity: {
    title: 'Активність клієнтів',
    columns: [
      { label: 'Email', key: 'Email', width: 160 },
      { label: "Ім'я", key: "Ім'я", width: 120 },
      { label: 'Телефон', key: 'Телефон', width: 100 },
      { label: 'Реєстрація', key: 'Дата реєстрації', width: 80 },
      { label: 'Замовлень', key: 'Замовлень за період', width: 70, align: 'right' },
      { label: 'Сума', key: 'Сума за період', width: 80, align: 'right' },
    ],
  },
  wholesale_report: {
    title: 'Оптові продажі',
    columns: [
      { label: '№', key: '№ замовлення', width: 80 },
      { label: 'Дата', key: 'Дата', width: 80 },
      { label: 'Клієнт', key: 'Клієнт', width: 100 },
      { label: 'Компанія', key: 'Компанія', width: 120 },
      { label: 'ЄДРПОУ', key: 'ЄДРПОУ', width: 80 },
      { label: 'Сума', key: 'Сума', width: 80, align: 'right' },
      { label: 'Оплата', key: 'Статус оплати', width: 80 },
    ],
  },
  delivery_report: {
    title: 'Звіт по доставках',
    columns: [
      { label: '№', key: '№ замовлення', width: 80 },
      { label: 'Дата', key: 'Дата', width: 80 },
      { label: 'Клієнт', key: 'Клієнт', width: 100 },
      { label: 'Метод', key: 'Метод доставки', width: 100 },
      { label: 'Місто', key: 'Місто', width: 100 },
      { label: 'ТТН', key: 'ТТН', width: 100 },
      { label: 'Вартість', key: 'Вартість доставки', width: 70, align: 'right' },
    ],
  },
  financial_report: {
    title: 'Фінансовий звіт',
    columns: [
      { label: 'Дата', key: 'Дата', width: 80 },
      { label: 'Замовлень', key: 'Замовлень', width: 65, align: 'right' },
      { label: 'Виручка', key: 'Виручка', width: 90, align: 'right' },
      { label: 'Знижки', key: 'Знижки', width: 80, align: 'right' },
      { label: 'Доставка', key: 'Доставка', width: 80, align: 'right' },
      { label: 'Чистий дохід', key: 'Чистий дохід', width: 90, align: 'right' },
      { label: 'Сер. чек', key: 'Середній чек', width: 80, align: 'right' },
    ],
  },
  returns_cancellations: {
    title: 'Повернення та скасування',
    columns: [
      { label: '№', key: '№ замовлення', width: 80 },
      { label: 'Дата', key: 'Дата', width: 80 },
      { label: 'Статус', key: 'Статус', width: 80 },
      { label: 'Клієнт', key: 'Клієнт', width: 100 },
      { label: 'Товарів', key: 'Товарів', width: 50, align: 'right' },
      { label: 'Сума', key: 'Сума', width: 80, align: 'right' },
      { label: 'Причина', key: 'Причина', width: 140 },
      { label: 'Ініціатор', key: 'Ініціатор', width: 80 },
    ],
  },
  wholesale_groups: {
    title: 'Звіт по оптових групах',
    columns: [
      { label: 'Група', key: 'Група', width: 100 },
      { label: "Ім'я", key: "Ім'я", width: 120 },
      { label: 'Компанія', key: 'Компанія', width: 130 },
      { label: 'Замовлень', key: 'Замовлень', width: 70, align: 'right' },
      { label: 'Сума', key: 'Сума', width: 90, align: 'right' },
      { label: 'Сер. чек', key: 'Середній чек', width: 80, align: 'right' },
    ],
  },
  product_leaders: {
    title: 'Товари-лідери та аутсайдери',
    columns: [
      { label: 'Код', key: 'Код', width: 60 },
      { label: 'Назва', key: 'Назва', width: 160 },
      { label: 'Категорія', key: 'Категорія', width: 100 },
      { label: 'Ціна', key: 'Ціна', width: 60, align: 'right' },
      { label: 'Залишок', key: 'Залишок', width: 50, align: 'right' },
      { label: 'Продано', key: 'Продано (шт)', width: 55, align: 'right' },
      { label: 'Сума', key: 'Продано (грн)', width: 70, align: 'right' },
      { label: 'Конв.%', key: 'Конверсія %', width: 50, align: 'right' },
    ],
  },
  manager_activity: {
    title: 'Активність менеджерів',
    columns: [
      { label: 'Менеджер', key: 'Менеджер', width: 120 },
      { label: 'Email', key: 'Email', width: 140 },
      { label: 'Замовлень', key: 'Оброблено замовлень', width: 70, align: 'right' },
      { label: 'Дій', key: 'Дій всього', width: 50, align: 'right' },
      { label: 'Підтв.', key: 'Підтверджено', width: 50, align: 'right' },
      { label: 'Відпр.', key: 'Відправлено', width: 50, align: 'right' },
      { label: 'Заверш.', key: 'Завершено', width: 55, align: 'right' },
      { label: 'Скасов.', key: 'Скасовано', width: 55, align: 'right' },
    ],
  },
  acquisition_channels: {
    title: 'Канали залучення',
    columns: [
      { label: 'Джерело', key: 'Джерело', width: 120 },
      { label: 'Замовлень', key: 'Замовлень', width: 70, align: 'right' },
      { label: 'Виручка', key: 'Виручка', width: 90, align: 'right' },
      { label: 'Скасовано', key: 'Скасовано', width: 65, align: 'right' },
      { label: 'Конв.%', key: 'Конверсія %', width: 60, align: 'right' },
      { label: 'Сер. чек', key: 'Середній чек', width: 80, align: 'right' },
    ],
  },
  summary_report: {
    title: 'Зведений звіт',
    columns: [
      { label: 'Показник', key: 'Показник', width: 300 },
      { label: 'Значення', key: 'Значення', width: 200, align: 'right' },
    ],
  },
  custom: {
    title: 'Власний звіт',
    columns: [
      { label: 'Показник', key: 'Показник', width: 300 },
      { label: 'Значення', key: 'Значення', width: 200, align: 'right' },
    ],
  },
};
