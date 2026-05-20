import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/../generated/prisma';

export class ExportError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
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
  // Mirror the list-page filters so admins export exactly what they see.
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryMethod?: string;
  assignedManagerId?: number;
  search?: string;
  format?: 'xlsx' | 'csv';
}

interface ExportClientsParams {
  role?: string;
  wholesaleStatus?: string;
  wholesaleGroup?: string;
  isBlocked?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  format?: 'xlsx' | 'csv';
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Build an xlsx (or csv) Buffer from a flat row array. Auto-widths each column
 * to fit content (capped at 50 chars). Centralises the ExcelJS boilerplate so
 * the individual export helpers stay focused on the data shape.
 */
async function buildBuffer(
  rows: Record<string, unknown>[],
  sheetName: string,
  format: 'xlsx' | 'csv',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));

  if (rows.length === 0) {
    if (format === 'csv') return Buffer.from('', 'utf-8');
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  const headers = Object.keys(rows[0]);
  ws.columns = headers.map((h) => {
    const maxDataLen = rows.reduce(
      (max, row) => Math.max(max, String(row[h] ?? '').length),
      0,
    );
    return {
      header: h,
      key: h,
      width: Math.min(Math.max(h.length, maxDataLen) + 3, 50),
    };
  });
  ws.addRows(rows);

  if (format === 'csv') {
    const buf = await wb.csv.writeBuffer();
    return Buffer.from(buf as ArrayBufferLike);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function mimeFor(format: 'xlsx' | 'csv'): string {
  return format === 'csv' ? 'text/csv' : XLSX_MIME;
}

export async function exportOrders(params: ExportOrdersParams = {}) {
  const {
    status,
    clientType,
    dateFrom,
    dateTo,
    paymentMethod,
    paymentStatus,
    deliveryMethod,
    assignedManagerId,
    search,
    format = 'xlsx',
  } = params;

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as Prisma.EnumOrderStatusFilter;
  if (clientType) where.clientType = clientType as Prisma.EnumClientTypeFilter;
  if (paymentMethod) where.paymentMethod = paymentMethod as Prisma.EnumPaymentMethodFilter;
  if (paymentStatus) where.paymentStatus = paymentStatus as Prisma.EnumPaymentStatusFilter;
  if (deliveryMethod)
    where.deliveryMethod = deliveryMethod as Prisma.EnumDeliveryMethodFilter;
  if (assignedManagerId) where.assignedManagerId = assignedManagerId;
  if (dateFrom)
    where.createdAt = { ...((where.createdAt as object) || {}), gte: new Date(dateFrom) };
  if (dateTo) where.createdAt = { ...((where.createdAt as object) || {}), lte: new Date(dateTo) };
  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { orderNumber: { contains: s, mode: 'insensitive' } },
      { contactName: { contains: s, mode: 'insensitive' } },
      { contactPhone: { contains: s } },
      { contactEmail: { contains: s, mode: 'insensitive' } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: true,
      user: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const STATUS_LABELS: Record<string, string> = {
    new_order: 'Нове',
    processing: 'В обробці',
    confirmed: 'Підтверджене',
    paid: 'Оплачене',
    shipped: 'Відправлене',
    completed: 'Виконане',
    cancelled: 'Скасоване',
    returned: 'Повернення',
  };
  const PAYMENT_LABELS: Record<string, string> = {
    cod: 'Накладений платіж',
    bank_transfer: 'На розрахунковий рахунок',
    online: 'Онлайн-оплата',
    card_prepay: 'Передоплата на картку',
  };
  const PAYMENT_STATUS: Record<string, string> = {
    pending: 'Очікує оплати',
    paid: 'Оплачено',
    partial: 'Часткова оплата',
    refunded: 'Повернення коштів',
  };
  const DELIVERY_LABELS: Record<string, string> = {
    nova_poshta: 'Нова Пошта',
    ukrposhta: 'Укрпошта',
    pickup: 'Самовивіз',
    pallet: 'Палетна доставка',
  };

  const rows = orders.map((o) => ({
    '№ замовлення': o.orderNumber,
    Дата: o.createdAt.toLocaleDateString('uk-UA'),
    Клієнт: o.contactName,
    Телефон: o.contactPhone,
    Email: o.contactEmail || '',
    Тип: o.clientType === 'wholesale' ? 'Гуртовий' : 'Роздрібний',
    Статус: STATUS_LABELS[o.status] || o.status,
    Оплата: PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod,
    'Статус оплати': PAYMENT_STATUS[o.paymentStatus] || o.paymentStatus,
    Доставка: DELIVERY_LABELS[o.deliveryMethod] || o.deliveryMethod,
    ТТН: o.trackingNumber || '',
    Місто: o.deliveryCity || '',
    'Кількість товарів': o.itemsCount,
    Знижка: Number(o.discountAmount),
    'Доставка (вартість)': Number(o.deliveryCost),
    Сума: Number(o.totalAmount),
    Коментар: o.comment || '',
  }));

  return {
    buffer: await buildBuffer(rows, 'Замовлення', format),
    filename: `orders_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: mimeFor(format),
  };
}

export async function exportClients(params: ExportClientsParams = {}) {
  const {
    role,
    wholesaleStatus,
    wholesaleGroup,
    isBlocked,
    dateFrom,
    dateTo,
    search,
    format = 'xlsx',
  } = params;

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as Prisma.EnumUserRoleFilter;
  if (wholesaleStatus) where.wholesaleStatus = wholesaleStatus as Prisma.EnumWholesaleStatusFilter;
  if (wholesaleGroup) where.wholesaleGroup = Number(wholesaleGroup);
  if (typeof isBlocked === 'boolean') where.isBlocked = isBlocked;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }

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
      wholesaleGroup: true,
      isBlocked: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = users.map((u) => ({
    ID: u.id,
    Email: u.email,
    "Ім'я": u.fullName || '',
    Телефон: u.phone || '',
    Компанія: u.companyName || '',
    ЄДРПОУ: u.edrpou || '',
    Роль: u.role,
    'Гуртовий статус': u.wholesaleStatus || '',
    'Гуртова група': u.wholesaleGroup ?? '',
    Заблоковано: u.isBlocked ? 'Так' : 'Ні',
    'Дата реєстрації': u.createdAt.toLocaleDateString('uk-UA'),
    'К-ть замовлень': u._count.orders,
  }));

  return {
    buffer: await buildBuffer(rows, 'Клієнти', format),
    filename: `clients_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: mimeFor(format),
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
    Код: p.code,
    Штрихкод: p.barcode || '',
    Назва: p.name,
    Категорія: p.category?.name || '',
    'Роздрібна ціна': Number(p.priceRetail),
    'Ціна: Дрібний опт': p.priceWholesale != null ? Number(p.priceWholesale) : '',
    'Ціна: Середній опт': p.priceWholesale2 != null ? Number(p.priceWholesale2) : '',
    'Ціна: Великий опт': p.priceWholesale3 != null ? Number(p.priceWholesale3) : '',
    Залишок: p.quantity,
    Акція: p.isPromo ? 'Так' : 'Ні',
    Статус: p.isActive ? 'Активний' : 'Неактивний',
  }));

  return {
    buffer: await buildBuffer(rows, 'Каталог', format),
    filename: `catalog_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: mimeFor(format),
  };
}

/**
 * Export products with full details (content, SEO, images).
 * Same format can be re-imported to create/update products.
 * @param ids — optional array of product IDs; if empty, exports all active products
 */
export async function exportProductsFull(params: { ids?: number[]; format?: 'xlsx' | 'csv' } = {}) {
  const { ids, format = 'xlsx' } = params;

  const where = ids?.length ? { id: { in: ids } } : { isActive: true, deletedAt: null };

  interface ProductWithRelations {
    code: string;
    barcode: string | null;
    name: string;
    priceRetail: { toNumber?: () => number } | number;
    priceWholesale: { toNumber?: () => number } | number | null;
    priceWholesale2: { toNumber?: () => number } | number | null;
    priceWholesale3: { toNumber?: () => number } | number | null;
    quantity: number;
    isPromo: boolean;
    isActive: boolean;
    category: { name: string } | null;
    content: {
      shortDescription: string | null;
      description: string | null;
      specifications: string | null;
      seoTitle: string | null;
      seoDescription: string | null;
      seoKeywords: string | null;
    } | null;
    images: { pathOriginal: string | null }[];
    badges: { badgeType: string }[];
  }

  const products = (await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true } },
      content: true,
      images: { orderBy: { sortOrder: 'asc' }, select: { pathOriginal: true } },
      badges: { select: { badgeType: true } },
    },
    orderBy: { name: 'asc' },
  })) as unknown as ProductWithRelations[];

  const rows = products.map((p) => ({
    Код: p.code,
    Штрихкод: p.barcode || '',
    Назва: p.name,
    Категорія: p.category?.name || '',
    'Роздрібна ціна': Number(p.priceRetail),
    'Ціна: Дрібний опт': p.priceWholesale != null ? Number(p.priceWholesale) : '',
    'Ціна: Середній опт': p.priceWholesale2 != null ? Number(p.priceWholesale2) : '',
    'Ціна: Великий опт': p.priceWholesale3 != null ? Number(p.priceWholesale3) : '',
    Залишок: p.quantity,
    Акція: p.isPromo ? 'Так' : 'Ні',
    Статус: p.isActive ? 'Активний' : 'Неактивний',
    'Короткий опис': p.content?.shortDescription || '',
    Опис: p.content?.description || '',
    Характеристики: p.content?.specifications || '',
    'SEO заголовок': p.content?.seoTitle || '',
    'SEO опис': p.content?.seoDescription || '',
    'SEO ключові слова': p.content?.seoKeywords || '',
    Зображення: p.images
      .map((img) => img.pathOriginal)
      .filter(Boolean)
      .join('; '),
    Бейджі: p.badges.map((b) => b.badgeType).join(', '),
  }));

  const suffix = ids?.length === 1 ? `product_${ids[0]}` : 'products_full';
  return {
    buffer: await buildBuffer(rows, 'Товари', format),
    filename: `${suffix}_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: mimeFor(format),
  };
}

/**
 * Lightweight price-update template: code + name + 4 price columns only.
 * Designed so the operator edits prices in Excel and re-uploads to bulk-update.
 */
export async function exportPriceTemplate(params: { format?: 'xlsx' | 'csv' } = {}) {
  const { format = 'xlsx' } = params;

  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      code: true,
      name: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
    },
    orderBy: { name: 'asc' },
  });

  const rows = products.map((p) => ({
    'Код продукції': p.code,
    Назва: p.name,
    'Ціна роздріб': Number(p.priceRetail),
    'Ціна опт': p.priceWholesale != null ? Number(p.priceWholesale) : '',
    'Ціна опт 2': p.priceWholesale2 != null ? Number(p.priceWholesale2) : '',
    'Ціна опт 3': p.priceWholesale3 != null ? Number(p.priceWholesale3) : '',
  }));

  return {
    buffer: await buildBuffer(rows, 'Ціни', format),
    filename: `price-template_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: mimeFor(format),
  };
}

/**
 * Full-import template: one example row showing every column the parser
 * recognises in the standard format. The operator fills in real data and
 * uploads via the "Повний прайс-лист" import flow.
 */
export async function exportProductTemplate(params: { format?: 'xlsx' | 'csv' } = {}) {
  const { format = 'xlsx' } = params;

  const rows = [
    {
      'Код продукції': 'EXAMPLE-001',
      Штрихкод: '4820000000017',
      Назва: 'Приклад товару',
      Категорія: 'Назва категорії',
      'Ціна роздріб': 100,
      'Ціна опт': 80,
      'Ціна опт 2': 75,
      'Ціна опт 3': 70,
      Кількість: 10,
      Акція: 'Ні',
      'Короткий опис': 'Опис у 1-2 рядках для списку',
      Опис: 'Повний опис товару (HTML дозволено)',
      Характеристики: 'Вага: 1кг; Колір: білий',
      'SEO заголовок': 'Купити приклад товару в Україні',
      'SEO опис': 'Опис для пошукових систем (до 160 символів)',
      'SEO ключові слова': 'приклад, товар, ключове слово',
      Зображення: 'https://example.com/photo.jpg',
    },
  ];

  return {
    buffer: await buildBuffer(rows, 'Товари', format),
    filename: `products-template_${new Date().toISOString().slice(0, 10)}.${format}`,
    contentType: mimeFor(format),
  };
}
