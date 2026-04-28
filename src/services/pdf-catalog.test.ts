import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfkit', () => {
  const mockDoc: Record<string, unknown> = {
    pipe: vi.fn().mockReturnThis(),
    font: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    rect: vi.fn().mockReturnThis(),
    roundedRect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    lineWidth: vi.fn().mockReturnThis(),
    image: vi.fn().mockReturnThis(),
    end: vi.fn(),
    on: vi.fn(),
  };
  mockDoc.y = 100;
  return {
    default: vi.fn(function () {
      return mockDoc;
    }),
  };
});

vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'finish') setTimeout(cb, 0);
    }),
  })),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => Buffer.from('mock-image')),
}));

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-qr')),
  },
}));

vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/test-uploads' },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/pdf-theme', () => ({
  BRAND: {
    text: '#000',
    textSecondary: '#666',
    textMuted: '#999',
    primary: '#0066cc',
    primaryDark: '#004499',
    danger: '#cc0000',
    success: '#00aa00',
    border: '#ccc',
    borderLight: '#eee',
    bgLight: '#fafafa',
    white: '#fff',
  },
  FONT_REGULAR: 'Regular',
  FONT_BOLD: 'Bold',
  PAGE: { margin: 40, contentWidth: 515 },
  setupDoc: vi.fn(),
  drawHeader: vi.fn(),
  drawDocTitle: vi.fn(),
  drawTableHeader: vi.fn(),
  drawTableRow: vi.fn(),
  drawFooter: vi.fn(),
  getCompanyInfo: vi.fn().mockResolvedValue({
    name: 'Test Co',
    description: 'Test Description',
  }),
}));

import { generatePriceList, generateIllustratedCatalog, PdfCatalogError } from './pdf-catalog';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PdfCatalogError', () => {
  it('should create error with default status code', () => {
    const err = new PdfCatalogError('test');
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('PdfCatalogError');
  });

  it('should create error with custom status code', () => {
    const err = new PdfCatalogError('not found', 404);
    expect(err.statusCode).toBe(404);
  });
});

describe('generatePriceList', () => {
  it('should generate a retail price list PDF', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Product 1',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 10,
        category: { name: 'Cat A' },
      },
    ] as never);

    const url = await generatePriceList({ type: 'retail' });
    expect(url).toMatch(/^\/uploads\/catalogs\/pricelist_retail_\d+\.pdf$/);
  });

  it('should generate a wholesale price list PDF', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Product 1',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 5,
        category: { name: 'Cat A' },
      },
    ] as never);

    const url = await generatePriceList({ type: 'wholesale' });
    expect(url).toMatch(/pricelist_wholesale_/);
  });

  it('should throw PdfCatalogError when no products found', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    await expect(generatePriceList({ type: 'retail' })).rejects.toThrow(
      'Немає товарів для генерації',
    );
  });

  it('should filter by categoryId when provided', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Product 1',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 10,
        category: { name: 'Cat A' },
      },
    ] as never);

    await generatePriceList({ type: 'retail', categoryId: 5 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 5 }),
      }),
    );
  });

  it('should create catalogs directory if not exists', async () => {
    const { existsSync, mkdirSync } = await import('fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Test',
        priceRetail: 10,
        priceWholesale: 8,
        quantity: 1,
        category: null,
      },
    ] as never);

    await generatePriceList({ type: 'retail' });

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('catalogs'), {
      recursive: true,
    });
  });

  it('should handle products with zero quantity', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Out of Stock',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 0,
        category: null,
      },
    ] as never);

    const url = await generatePriceList({ type: 'retail' });
    expect(url).toBeTruthy();
  });

  it('should handle large product lists', async () => {
    const { prisma } = await import('@/lib/prisma');
    const products = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      code: `P${i}`,
      name: `Product ${i}`,
      priceRetail: 100,
      priceWholesale: 80,
      quantity: 10,
      category: { name: 'Cat' },
    }));
    vi.mocked(prisma.product.findMany).mockResolvedValue(products as never);

    const url = await generatePriceList({ type: 'retail' });
    expect(url).toBeTruthy();
  });
});

describe('generateIllustratedCatalog', () => {
  it('should generate an illustrated catalog PDF', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Product 1',
        priceRetail: 100,
        priceWholesale: 80,
        quantity: 5,
        isPromo: false,
        category: { name: 'Cat A' },
      },
    ] as never);

    const url = await generateIllustratedCatalog();
    expect(url).toMatch(/^\/uploads\/catalogs\/catalog_illustrated_\d+\.pdf$/);
  });

  it('should throw PdfCatalogError when no products found', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);

    await expect(generateIllustratedCatalog()).rejects.toThrow('Немає товарів для генерації');
  });

  it('should filter by categoryId', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Test',
        priceRetail: 10,
        priceWholesale: 8,
        quantity: 1,
        isPromo: false,
        category: { name: 'Cat' },
      },
    ] as never);

    await generateIllustratedCatalog({ categoryId: 3 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 3 }),
      }),
    );
  });

  it('should filter promo-only products', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'P1',
        name: 'Promo',
        priceRetail: 50,
        priceWholesale: 40,
        quantity: 3,
        isPromo: true,
        category: { name: 'Cat' },
      },
    ] as never);

    await generateIllustratedCatalog({ promoOnly: true });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPromo: true }),
      }),
    );
  });

  it('should handle products without category', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'NC1',
        name: 'No Cat',
        priceRetail: 10,
        priceWholesale: 8,
        quantity: 1,
        isPromo: false,
        category: null,
      },
    ] as never);

    const url = await generateIllustratedCatalog();
    expect(url).toBeTruthy();
  });

  it('generates a QR code per product pointing at the product page', async () => {
    const { default: QRCode } = await import('qrcode');
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        code: 'A',
        name: 'A',
        slug: 'a-slug',
        priceRetail: 1,
        priceWholesale: 1,
        quantity: 1,
        isPromo: false,
        imagePath: null,
        category: { name: 'Cat' },
      },
      {
        id: 2,
        code: 'B',
        name: 'B',
        slug: 'b-slug',
        priceRetail: 1,
        priceWholesale: 1,
        quantity: 1,
        isPromo: true,
        imagePath: null,
        category: { name: 'Cat' },
      },
    ] as never);

    await generateIllustratedCatalog();

    expect(QRCode.toBuffer).toHaveBeenCalledTimes(2);
    expect(vi.mocked(QRCode.toBuffer).mock.calls[0][0]).toContain('/product/a-slug');
    expect(vi.mocked(QRCode.toBuffer).mock.calls[0][0]).toContain('utm_source=catalog_pdf');
  });
});
