import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn() },
    payment: { update: vi.fn() },
  },
}));

vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/test-uploads' },
}));

vi.mock('pdfkit', () => {
  const mockDoc = {
    registerFont: vi.fn().mockReturnThis(),
    font: vi.fn().mockReturnThis(),
    pipe: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    end: vi.fn(),
    y: 100,
  };
  const MockPDFDocument = vi.fn(function () {
    return mockDoc;
  });
  return { default: MockPDFDocument };
});

vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => {
    const stream = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') setTimeout(cb, 0);
        return stream;
      }),
    };
    return stream;
  }),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

import { prisma } from '@/lib/prisma';
import {
  PdfError,
  generateInvoicePdf,
  generateDeliveryNotePdf,
  generateCommercialOfferPdf,
} from './pdf';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// PdfError
// ---------------------------------------------------------------------------
describe('PdfError', () => {
  it('should create an error with default statusCode 400', () => {
    const error = new PdfError('test error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PdfError);
    expect(error.message).toBe('test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('PdfError');
  });

  it('should create an error with a custom statusCode', () => {
    const error = new PdfError('not found', 404);

    expect(error.message).toBe('not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('PdfError');
  });
});

// ---------------------------------------------------------------------------
// generateInvoicePdf
// ---------------------------------------------------------------------------
describe('generateInvoicePdf', () => {
  it('should throw PdfError 404 when order is not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    await expect(generateInvoicePdf(999)).rejects.toThrow(PdfError);
    await expect(generateInvoicePdf(999)).rejects.toThrow('Замовлення не знайдено');

    try {
      await generateInvoicePdf(999);
    } catch (e) {
      expect((e as PdfError).statusCode).toBe(404);
    }
  });

  it('should generate a PDF and return a public URL', async () => {
    const mockOrder = {
      id: 1,
      orderNumber: 'ORD-001',
      createdAt: new Date('2025-01-15'),
      contactName: 'Іван Петренко',
      contactPhone: '+380991234567',
      contactEmail: 'ivan@example.com',
      deliveryCity: 'Київ',
      deliveryAddress: 'вул. Хрещатик 1',
      discountAmount: 50,
      deliveryCost: 70,
      totalAmount: 500,
      items: [
        {
          productCode: 'P001',
          productName: 'Засіб для миття',
          priceAtOrder: 150,
          quantity: 3,
          subtotal: 450,
        },
      ],
      payment: { id: 10, invoicePdfUrl: null },
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);
    mockPrisma.payment.update.mockResolvedValue({} as never);

    const url = await generateInvoicePdf(1);

    expect(url).toMatch(/^\/uploads\/invoices\/invoice_ORD-001_\d+\.pdf$/);

    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { items: true, payment: true },
    });

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { invoicePdfUrl: url },
    });
  });

  it('should not update payment when order has no payment record', async () => {
    const mockOrder = {
      id: 2,
      orderNumber: 'ORD-002',
      createdAt: new Date('2025-02-01'),
      contactName: 'Олена Коваленко',
      contactPhone: '+380997654321',
      contactEmail: null,
      deliveryCity: null,
      deliveryAddress: null,
      discountAmount: 0,
      deliveryCost: 0,
      totalAmount: 200,
      items: [
        {
          productCode: 'P002',
          productName: 'Порошок',
          priceAtOrder: 100,
          quantity: 2,
          subtotal: 200,
        },
      ],
      payment: null,
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);

    const url = await generateInvoicePdf(2);

    expect(url).toMatch(/^\/uploads\/invoices\/invoice_ORD-002_\d+\.pdf$/);
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// generateDeliveryNotePdf
// ---------------------------------------------------------------------------
describe('generateDeliveryNotePdf', () => {
  it('should throw PdfError 404 when order is not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null as never);

    await expect(generateDeliveryNotePdf(999)).rejects.toThrow(PdfError);
    await expect(generateDeliveryNotePdf(999)).rejects.toThrow('Замовлення не знайдено');

    try {
      await generateDeliveryNotePdf(999);
    } catch (e) {
      expect((e as PdfError).statusCode).toBe(404);
    }
  });

  it('should generate a delivery note PDF and return a public URL', async () => {
    const mockOrder = {
      id: 3,
      orderNumber: 'ORD-003',
      createdAt: new Date('2025-03-10'),
      contactName: 'Марія Шевченко',
      contactPhone: '+380501112233',
      contactEmail: 'maria@example.com',
      deliveryCity: 'Львів',
      deliveryAddress: 'вул. Франка 5',
      trackingNumber: 'NP-123456789',
      totalAmount: 350,
      items: [
        {
          productCode: 'P003',
          productName: 'Гель для прання',
          priceAtOrder: 175,
          quantity: 2,
          subtotal: 350,
        },
      ],
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);

    const url = await generateDeliveryNotePdf(3);

    expect(url).toMatch(/^\/uploads\/delivery-notes\/delivery_note_ORD-003_\d+\.pdf$/);

    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      include: { items: true },
    });
  });
});

// ---------------------------------------------------------------------------
// generateCommercialOfferPdf
// ---------------------------------------------------------------------------
describe('generateCommercialOfferPdf', () => {
  it('should throw PdfError 400 when products list is empty', async () => {
    await expect(generateCommercialOfferPdf([])).rejects.toThrow(PdfError);
    await expect(generateCommercialOfferPdf([])).rejects.toThrow('Список товарів порожній');

    try {
      await generateCommercialOfferPdf([]);
    } catch (e) {
      expect((e as PdfError).statusCode).toBe(400);
    }
  });

  it('should generate a commercial offer PDF and return a public URL', async () => {
    const products = [
      { code: 'C001', name: 'Засіб для підлоги', price: 89.99 },
      { code: 'C002', name: 'Засіб для вікон', price: 65.5, unit: 'л' },
    ];

    const url = await generateCommercialOfferPdf(products, 'ТОВ Клієнт');

    expect(url).toMatch(/^\/uploads\/offers\/offer_\d+\.pdf$/);
  });

  it('should generate a commercial offer PDF without client name', async () => {
    const products = [{ code: 'C003', name: 'Мило', price: 25.0 }];

    const url = await generateCommercialOfferPdf(products);

    expect(url).toMatch(/^\/uploads\/offers\/offer_\d+\.pdf$/);
  });
});

describe('generateInvoicePdf - directory creation', () => {
  it('should create directory when it does not exist', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);

    const mockOrder = {
      id: 5,
      orderNumber: 'ORD-005',
      createdAt: new Date('2025-04-01'),
      contactName: 'Тест',
      contactPhone: '+380991111111',
      contactEmail: null,
      deliveryCity: null,
      deliveryAddress: null,
      discountAmount: 0,
      deliveryCost: 0,
      totalAmount: 100,
      items: [{ productCode: null, productName: 'Item', priceAtOrder: 100, quantity: 1, subtotal: 100 }],
      payment: null,
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);

    const url = await generateInvoicePdf(5);
    expect(url).toMatch(/^\/uploads\/invoices\/invoice_ORD-005_\d+\.pdf$/);
    expect(fs.mkdirSync).toHaveBeenCalled();
  });
});

describe('generateInvoicePdf - many items causing page break', () => {
  it('should handle many items (y > 700 triggers addPage)', async () => {
    // Create many items to trigger the y > 700 page break
    const items = Array.from({ length: 40 }, (_, i) => ({
      productCode: `P${i}`,
      productName: `Product ${i}`,
      priceAtOrder: 100,
      quantity: 1,
      subtotal: 100,
    }));

    const mockOrder = {
      id: 10,
      orderNumber: 'ORD-010',
      createdAt: new Date('2025-06-01'),
      contactName: 'Test',
      contactPhone: '+380501111111',
      contactEmail: null,
      deliveryCity: null,
      deliveryAddress: null,
      discountAmount: 0,
      deliveryCost: 0,
      totalAmount: 4000,
      items,
      payment: null,
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);

    const url = await generateInvoicePdf(10);
    expect(url).toMatch(/^\/uploads\/invoices\/invoice_ORD-010_\d+\.pdf$/);
  });
});

describe('generateDeliveryNotePdf - many items causing page break', () => {
  it('should handle many items (y > 700 triggers addPage)', async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      productCode: `P${i}`,
      productName: `Product ${i}`,
      priceAtOrder: 100,
      quantity: 1,
      subtotal: 100,
    }));

    const mockOrder = {
      id: 11,
      orderNumber: 'ORD-011',
      createdAt: new Date('2025-06-01'),
      contactName: 'Test',
      contactPhone: '+380501111111',
      contactEmail: null,
      deliveryCity: null,
      deliveryAddress: null,
      trackingNumber: null,
      totalAmount: 4000,
      items,
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);

    const url = await generateDeliveryNotePdf(11);
    expect(url).toMatch(/^\/uploads\/delivery-notes\/delivery_note_ORD-011_\d+\.pdf$/);
  });
});

describe('generateCommercialOfferPdf - many products causing page break', () => {
  it('should handle many products (y > 700 triggers addPage)', async () => {
    const products = Array.from({ length: 40 }, (_, i) => ({
      code: `C${i}`,
      name: `Product ${i}`,
      price: 100,
    }));

    const url = await generateCommercialOfferPdf(products, 'Large Client');
    expect(url).toMatch(/^\/uploads\/offers\/offer_\d+\.pdf$/);
  });
});

describe('generateDeliveryNotePdf - directory creation', () => {
  it('should create directory when it does not exist (line 184)', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);

    const mockOrder = {
      id: 20,
      orderNumber: 'ORD-020',
      createdAt: new Date('2025-07-01'),
      contactName: 'Тест',
      contactPhone: '+380991111111',
      contactEmail: null,
      deliveryCity: null,
      deliveryAddress: null,
      trackingNumber: null,
      totalAmount: 100,
      items: [{ productCode: null, productName: 'Item', priceAtOrder: 100, quantity: 1, subtotal: 100 }],
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);

    const url = await generateDeliveryNotePdf(20);
    expect(url).toMatch(/^\/uploads\/delivery-notes\/delivery_note_ORD-020_\d+\.pdf$/);
    expect(fs.mkdirSync).toHaveBeenCalled();
  });
});

describe('generateCommercialOfferPdf - directory creation', () => {
  it('should create directory when it does not exist (line 308)', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);

    const url = await generateCommercialOfferPdf([{ code: 'C099', name: 'Test', price: 50 }]);
    expect(url).toMatch(/^\/uploads\/offers\/offer_\d+\.pdf$/);
    expect(fs.mkdirSync).toHaveBeenCalled();
  });
});

describe('generateDeliveryNotePdf - without optional fields', () => {
  it('should handle order without contactEmail, city, address, tracking', async () => {
    const mockOrder = {
      id: 6,
      orderNumber: 'ORD-006',
      createdAt: new Date('2025-05-01'),
      contactName: 'Мінімальний замовник',
      contactPhone: '+380505555555',
      contactEmail: null,
      deliveryCity: null,
      deliveryAddress: null,
      trackingNumber: null,
      totalAmount: 200,
      items: [{ productCode: null, productName: 'Товар', priceAtOrder: 200, quantity: 1, subtotal: 200 }],
    };

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder as never);
    const url = await generateDeliveryNotePdf(6);
    expect(url).toMatch(/^\/uploads\/delivery-notes\/delivery_note_ORD-006_\d+\.pdf$/);
  });
});
