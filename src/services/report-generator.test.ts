import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  order: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  orderStatusHistory: {
    findMany: vi.fn(),
  },
}));

const mockXLSX = vi.hoisted(() => ({
  utils: {
    book_new: vi.fn().mockReturnValue({}),
    json_to_sheet: vi.fn().mockReturnValue({}),
    book_append_sheet: vi.fn(),
    sheet_to_csv: vi.fn().mockReturnValue('col1,col2\nval1,val2'),
  },
  write: vi.fn().mockReturnValue(Buffer.from('xlsx-data')),
}));

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  createWriteStream: vi.fn().mockReturnValue({
    on: vi.fn().mockImplementation(function (this: { on: unknown }, event: string, cb: () => void) {
      if (event === 'finish') setTimeout(cb, 0);
      return this;
    }),
    write: vi.fn(),
    end: vi.fn(),
  }),
}));

const mockPdfDoc = vi.hoisted(() => {
  const doc: Record<string, unknown> = {};
  doc.font = vi.fn().mockReturnValue(doc);
  doc.fontSize = vi.fn().mockReturnValue(doc);
  doc.fillColor = vi.fn().mockReturnValue(doc);
  doc.text = vi.fn().mockReturnValue(doc);
  doc.moveTo = vi.fn().mockReturnValue(doc);
  doc.lineTo = vi.fn().mockReturnValue(doc);
  doc.stroke = vi.fn().mockReturnValue(doc);
  doc.addPage = vi.fn().mockReturnValue(doc);
  doc.pipe = vi.fn().mockReturnValue(doc);
  doc.end = vi.fn();
  doc.y = 100;
  doc.page = { margins: { bottom: 50 } };
  doc.on = vi.fn().mockReturnValue(doc);
  return doc;
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/test-uploads' },
}));
vi.mock('xlsx', () => mockXLSX);
vi.mock('fs', () => ({
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  writeFileSync: mockFs.writeFileSync,
  createWriteStream: mockFs.createWriteStream,
}));
vi.mock('pdfkit', () => ({
  default: vi.fn(() => mockPdfDoc),
}));
vi.mock('@/lib/pdf-theme', () => ({
  BRAND: {
    primary: '#2563EB',
    primaryLight: '#E0E7FF',
    primaryDark: '#1E40AF',
    text: '#1E293B',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
  },
  FONT_REGULAR: '/fonts/regular.ttf',
  PAGE: { width: 841.89, height: 595.28 },
  setupDoc: vi.fn(),
  drawHeader: vi.fn(),
  drawDocTitle: vi.fn(),
  drawFooter: vi.fn(),
  getCompanyInfo: vi.fn().mockResolvedValue({ name: 'Test', website: 'test.com' }),
}));

import { generateReport } from './report-generator';

beforeEach(() => {
  vi.clearAllMocks();
  mockFs.existsSync.mockReturnValue(true);
});

describe('generateReport', () => {
  describe('sales_summary', () => {
    it('should generate sales summary as XLSX', async () => {
      const orders = [
        { createdAt: new Date('2025-06-01'), totalAmount: 500, itemsCount: 3 },
        { createdAt: new Date('2025-06-01'), totalAmount: 300, itemsCount: 2 },
        { createdAt: new Date('2025-06-02'), totalAmount: 1000, itemsCount: 5 },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await generateReport('sales_summary', 'xlsx', {});

      expect(result.url).toContain('/uploads/reports/sales_summary_');
      expect(result.url).toContain('.xlsx');
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled();

      // Verify data aggregation
      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      // Two unique dates
      expect(rows).toHaveLength(2);
    });

    it('should aggregate revenue correctly per date', async () => {
      const orders = [
        { createdAt: new Date('2025-01-15'), totalAmount: 100, itemsCount: 1 },
        { createdAt: new Date('2025-01-15'), totalAmount: 200, itemsCount: 2 },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      await generateReport('sales_summary', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows[0]['Виручка']).toBe(300);
      expect(rows[0]['Замовлень']).toBe(2);
      expect(rows[0]['Товарів']).toBe(3);
      expect(rows[0]['Середній чек']).toBe(150);
    });

    it('should handle date range filters', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await generateReport('sales_summary', 'xlsx', {
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
      });

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toEqual(new Date('2025-01-01'));
      expect(call.where.createdAt.lte).toBeDefined();
    });

    it('should handle empty data', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await generateReport('sales_summary', 'xlsx', {});

      expect(result.url).toBeDefined();
      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows).toEqual([]);
    });
  });

  describe('financial_report', () => {
    it('should calculate net income correctly', async () => {
      const orders = [
        {
          createdAt: new Date('2025-03-10'),
          totalAmount: 1000,
          discountAmount: 50,
          deliveryCost: 100,
        },
        {
          createdAt: new Date('2025-03-10'),
          totalAmount: 500,
          discountAmount: 0,
          deliveryCost: 0,
        },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      await generateReport('financial_report', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0]['Виручка']).toBe(1500);
      expect(rows[0]['Знижки']).toBe(50);
      expect(rows[0]['Доставка']).toBe(100);
      expect(rows[0]['Чистий дохід']).toBe(1350);
      expect(rows[0]['Середній чек']).toBe(750);
    });

    it('should handle zero revenue', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await generateReport('financial_report', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows).toEqual([]);
    });

    it('should handle orders with zero discounts and delivery', async () => {
      const orders = [
        {
          createdAt: new Date('2025-05-01'),
          totalAmount: 250,
          discountAmount: 0,
          deliveryCost: 0,
        },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      await generateReport('financial_report', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows[0]['Чистий дохід']).toBe(250);
    });
  });

  describe('products_stock', () => {
    it('should list active products with stock info', async () => {
      const products = [
        {
          code: 'A-1',
          name: 'Ariel',
          quantity: 50,
          priceRetail: 200,
          priceWholesale: 180,
          priceWholesale2: null,
          priceWholesale3: null,
          category: { name: 'Порошки' },
          _count: { orderItems: 10 },
        },
      ];
      mockPrisma.product.findMany.mockResolvedValue(products);

      await generateReport('products_stock', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows[0]['Код']).toBe('A-1');
      expect(rows[0]['Назва']).toBe('Ariel');
      expect(rows[0]['Залишок']).toBe(50);
      expect(rows[0]['Роздрібна ціна']).toBe(200);
      expect(rows[0]['Оптова ціна']).toBe(180);
      expect(rows[0]['Продано (шт)']).toBe(10);
    });
  });

  describe('CSV format', () => {
    it('should generate CSV output', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await generateReport('sales_summary', 'csv', {});

      expect(result.url).toContain('.csv');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('summary_report', () => {
    it('should aggregate key metrics', async () => {
      mockPrisma.order.count
        .mockResolvedValueOnce(100)  // total orders
        .mockResolvedValueOnce(5)    // cancelled
        .mockResolvedValueOnce(2);   // returned
      mockPrisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 50000 } })   // revenue
        .mockResolvedValueOnce({ _sum: { discountAmount: 2000 } })  // discounts
        .mockResolvedValueOnce({ _sum: { deliveryCost: 3000 } });   // delivery
      mockPrisma.user.count
        .mockResolvedValueOnce(25)   // new users
        .mockResolvedValueOnce(10);  // wholesalers
      mockPrisma.product.count
        .mockResolvedValueOnce(200)  // active products
        .mockResolvedValueOnce(15);  // out of stock

      await generateReport('summary_report', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      const findRow = (label: string) => rows.find((r: Record<string, unknown>) => r['Показник'] === label);

      expect(findRow('Виручка')['Значення']).toBe(50000);
      expect(findRow('Знижки')['Значення']).toBe(2000);
      expect(findRow('Доставка')['Значення']).toBe(3000);
      expect(findRow('Чистий дохід')['Значення']).toBe(45000);
      expect(findRow('Середній чек')['Значення']).toBe(500);
      expect(findRow('Скасовано')['Значення']).toBe(5);
      expect(findRow('Повернуто')['Значення']).toBe(2);
      expect(findRow('Активних товарів')['Значення']).toBe(200);
      expect(findRow('Немає в наявності')['Значення']).toBe(15);
    });

    it('should handle zero orders (avoid division by zero)', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: null, discountAmount: null, deliveryCost: null } });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.product.count.mockResolvedValue(0);

      await generateReport('summary_report', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      const avgCheck = rows.find((r: Record<string, unknown>) => r['Показник'] === 'Середній чек');
      expect(avgCheck['Значення']).toBe(0);
    });
  });

  describe('returns_cancellations', () => {
    it('should list cancelled and returned orders', async () => {
      const orders = [
        {
          orderNumber: 'ORD-001',
          createdAt: new Date('2025-02-10'),
          status: 'cancelled',
          totalAmount: 500,
          cancelledReason: 'Змінив рішення',
          cancelledBy: 'client',
          contactName: 'Іван',
          itemsCount: 2,
        },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      await generateReport('returns_cancellations', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows[0]['Статус']).toBe('Скасовано');
      expect(rows[0]['Причина']).toBe('Змінив рішення');
    });

    it('should show default reason when not provided', async () => {
      const orders = [
        {
          orderNumber: 'ORD-002',
          createdAt: new Date('2025-03-01'),
          status: 'returned',
          totalAmount: 200,
          cancelledReason: null,
          cancelledBy: null,
          contactName: 'Олена',
          itemsCount: 1,
        },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      await generateReport('returns_cancellations', 'xlsx', {});

      const rows = mockXLSX.utils.json_to_sheet.mock.calls[0][0];
      expect(rows[0]['Причина']).toBe('Не вказано');
      expect(rows[0]['Ініціатор']).toBe('Не вказано');
    });
  });

  describe('directory creation', () => {
    it('should create reports directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await generateReport('sales_summary', 'xlsx', {});

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('reports'),
        { recursive: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await generateReport('sales_summary', 'xlsx', {});

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('custom report', () => {
    it('should delegate to sales_summary for orders entity', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await generateReport('custom', 'xlsx', { entity: 'orders' });

      expect(mockPrisma.order.findMany).toHaveBeenCalled();
    });

    it('should delegate to products_stock by default', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await generateReport('custom', 'xlsx', {});

      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });
  });
});
