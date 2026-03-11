import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/../generated/prisma';

export class ExportError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

interface ExportOrdersParams {
  status?: string;
  clientType?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: 'xlsx' | 'csv';
}

interface ExportClientsParams {
  role?: string;
  format?: 'xlsx' | 'csv';
}

function autoFitColumns(ws: XLSX.WorkSheet, data: Record<string, unknown>[]) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const colWidths = headers.map((header) => {
    const maxDataLen = data.reduce((max, row) => {
      const val = String(row[header] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.min(Math.max(header.length, maxDataLen) + 3, 50);
  });
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));
}

function toBuffer(workbook: XLSX.WorkBook, format: 'xlsx' | 'csv'): Buffer {
  if (format === 'csv') {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return Buffer.from(csv, 'utf-8');
  }
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

export async function exportOrders(params: ExportOrdersParams = {}) {
  const { status, clientType, dateFrom, dateTo, format = 'xlsx' } = params;

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as Prisma.EnumOrderStatusFilter;
  if (clientType) where.clientType = clientType as Prisma.EnumClientTypeFilter;
  if (dateFrom) where.createdAt = { ...((where.createdAt as object) || {}), gte: new Date(dateFrom) };
  if (dateTo) where.createdAt = { ...((where.createdAt as object) || {}), lte: new Date(dateTo) };

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: true,
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const STATUS_LABELS: Record<string, string> = {
    new_order: 'Нове', processing: 'В обробці', confirmed: 'Підтверджене',
    paid: 'Оплачене', shipped: 'Відправлене', completed: 'Виконане',
    cancelled: 'Скасоване', returned: 'Повернення',
  };
  const PAYMENT_LABELS: Record<string, string> = {
    cod: 'Накладений платіж', bank_transfer: 'На розрахунковий рахунок',
    online: 'Онлайн-оплата', card_prepay: 'Передоплата на картку',
  };
  const PAYMENT_STATUS: Record<string, string> = {
    pending: 'Очікує оплати', paid: 'Оплачено', partial: 'Часткова оплата', refunded: 'Повернення коштів',
  };
  const DELIVERY_LABELS: Record<string, string> = {
    nova_poshta: 'Нова Пошта', ukrposhta: 'Укрпошта', pickup: 'Самовивіз', pallet: 'Палетна доставка',
  };

  const rows = orders.map((o) => ({
    '№ замовлення': o.orderNumber,
    'Дата': o.createdAt.toLocaleDateString('uk-UA'),
    'Клієнт': o.contactName,
    'Телефон': o.contactPhone,
    'Email': o.contactEmail || '',
    'Тип': o.clientType === 'wholesale' ? 'Оптовий' : 'Роздрібний',
    'Статус': STATUS_LABELS[o.status] || o.status,
    'Оплата': PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod,
    'Статус оплати': PAYMENT_STATUS[o.paymentStatus] || o.paymentStatus,
    'Доставка': DELIVERY_LABELS[o.deliveryMethod] || o.deliveryMethod,
    'ТТН': o.trackingNumber || '',
    'Місто': o.deliveryCity || '',
    'Кількість товарів': o.itemsCount,
    'Знижка': Number(o.discountAmount),
    'Доставка (вартість)': Number(o.deliveryCost),
    'Сума': Number(o.totalAmount),
    'Коментар': o.comment || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Замовлення');

  return {
    buffer: toBuffer(wb, format),
    filename: `orders_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function exportClients(params: ExportClientsParams = {}) {
  const { role, format = 'xlsx' } = params;

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as Prisma.EnumUserRoleFilter;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      companyName: true,
      edrpou: true,
      role: true,
      wholesaleStatus: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = users.map((u) => ({
    'ID': u.id,
    'Email': u.email,
    "Ім'я": u.fullName || '',
    'Телефон': u.phone || '',
    'Компанія': u.companyName || '',
    'ЄДРПОУ': u.edrpou || '',
    'Роль': u.role,
    'Оптовий статус': u.wholesaleStatus || '',
    'Дата реєстрації': u.createdAt.toLocaleDateString('uk-UA'),
    'К-ть замовлень': u._count.orders,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Клієнти');

  return {
    buffer: toBuffer(wb, format),
    filename: `clients_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function exportCatalog(params: { format?: 'xlsx' | 'csv' } = {}) {
  const { format = 'xlsx' } = params;

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const rows = products.map((p) => ({
    'Код': p.code,
    'Назва': p.name,
    'Категорія': p.category?.name || '',
    'Роздрібна ціна': Number(p.priceRetail),
    'Ціна: Дрібний опт': p.priceWholesale != null ? Number(p.priceWholesale) : '',
    'Ціна: Середній опт': p.priceWholesale2 != null ? Number(p.priceWholesale2) : '',
    'Ціна: Великий опт': p.priceWholesale3 != null ? Number(p.priceWholesale3) : '',
    'Залишок': p.quantity,
    'Акція': p.isPromo ? 'Так' : 'Ні',
    'Статус': p.isActive ? 'Активний' : 'Неактивний',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Каталог');

  return {
    buffer: toBuffer(wb, format),
    filename: `catalog_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
