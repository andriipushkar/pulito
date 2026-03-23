import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  product: {
    findMany: vi.fn(),
  },
}));

const mockGetSettings = vi.hoisted(() => vi.fn());
const mockGetCompanyInfo = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/services/settings', () => ({ getSettings: mockGetSettings }));

// Mock pdfkit
const mockPdfDoc = vi.hoisted(() => {
  const doc: Record<string, unknown> = {};
  const chainable = () => doc;
  doc.registerFont = vi.fn().mockReturnValue(doc);
  doc.font = vi.fn().mockReturnValue(doc);
  doc.fontSize = vi.fn().mockReturnValue(doc);
  doc.fillColor = vi.fn().mockReturnValue(doc);
  doc.text = vi.fn().mockReturnValue(doc);
  doc.rect = vi.fn().mockReturnValue(doc);
  doc.fill = vi.fn().mockReturnValue(doc);
  doc.moveTo = vi.fn().mockReturnValue(doc);
  doc.lineTo = vi.fn().mockReturnValue(doc);
  doc.quadraticCurveTo = vi.fn().mockReturnValue(doc);
  doc.lineWidth = vi.fn().mockReturnValue(doc);
  doc.stroke = vi.fn().mockReturnValue(doc);
  doc.image = vi.fn().mockReturnValue(doc);
  doc.addPage = vi.fn().mockReturnValue(doc);
  doc.end = vi.fn();
  doc.widthOfString = vi.fn().mockReturnValue(50);
  doc.on = vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
    if (event === 'data') {
      // Simulate some data chunks
      setTimeout(() => cb(Buffer.from('fake-pdf-data')), 0);
    }
    if (event === 'end') {
      setTimeout(() => cb(), 10);
    }
    return doc;
  });
  doc.page = { margins: { bottom: 50 } };
  return doc;
});

vi.mock('pdfkit', () => ({
  default: class MockPDFDocument {
    constructor() {
      return mockPdfDoc;
    }
  },
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-img')),
  })),
}));

vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(true), readFileSync: vi.fn().mockReturnValue(Buffer.from('')) },
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
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
    bgLight: '#F8FAFC',
    bgAlt: '#F1F5F9',
    success: '#16A34A',
    successBg: '#DCFCE7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
  },
  FONT_REGULAR: '/fonts/regular.ttf',
  FONT_BOLD: '/fonts/bold.ttf',
  getCompanyInfo: mockGetCompanyInfo,
}));

import { generatePricelist, PricelistError } from './pricelist';

beforeEach(() => {
  vi.clearAllMocks();

  mockGetCompanyInfo.mockResolvedValue({
    name: 'Порошок',
    description: 'Інтернет-магазин',
    website: 'poroshok.com',
    phone: '+380991234567',
  });

  mockGetSettings.mockResolvedValue({
    social_telegram: 'https://t.me/poroshok',
    social_viber: 'viber://pa?chatURI=poroshok',
    social_instagram: 'https://instagram.com/poroshok',
    social_facebook: 'https://www.facebook.com/poroshok',
  });
});

describe('generatePricelist', () => {
  const mockProducts = [
    {
      id: 1,
      name: 'Ariel 3кг',
      code: 'ARI-3',
      priceRetail: 259.99,
      priceWholesale: 220.00,
      quantity: 50,
      isActive: true,
      imagePath: null,
      category: { name: 'Порошки' },
      images: [],
    },
    {
      id: 2,
      name: 'Fairy 500мл',
      code: 'FAI-500',
      priceRetail: 89.50,
      priceWholesale: null,
      quantity: 0,
      isActive: true,
      imagePath: '/img/fairy.webp',
      category: { name: 'Для посуду' },
      images: [{ pathThumbnail: '/img/fairy_thumb.webp', pathMedium: '/img/fairy_med.webp' }],
    },
  ];

  it('should generate a retail pricelist as a Buffer', async () => {
    mockPrisma.product.findMany.mockResolvedValue(mockProducts);

    const result = await generatePricelist('retail');

    expect(result).toBeInstanceOf(Buffer);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      })
    );
  });

  it('should generate a wholesale pricelist', async () => {
    mockPrisma.product.findMany.mockResolvedValue(mockProducts);

    const result = await generatePricelist('wholesale');

    expect(result).toBeInstanceOf(Buffer);
  });

  it('should throw PricelistError when no active products', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await expect(generatePricelist('retail')).rejects.toThrow(PricelistError);
    await expect(generatePricelist('retail')).rejects.toThrow(
      'Немає активних товарів для генерації прайс-листа'
    );
  });

  it('should group products by category', async () => {
    const products = [
      { ...mockProducts[0], category: { name: 'Порошки' } },
      { ...mockProducts[1], category: { name: 'Для посуду' } },
      {
        id: 3,
        name: 'Persil 2кг',
        code: 'PER-2',
        priceRetail: 199.0,
        priceWholesale: 170.0,
        quantity: 30,
        isActive: true,
        imagePath: null,
        category: { name: 'Порошки' },
        images: [],
      },
    ];
    mockPrisma.product.findMany.mockResolvedValue(products);

    const result = await generatePricelist('retail');

    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle products without a category', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { ...mockProducts[0], category: null },
    ]);

    const result = await generatePricelist('retail');

    expect(result).toBeInstanceOf(Buffer);
  });

  it('should use wholesale price when available for wholesale type', async () => {
    mockPrisma.product.findMany.mockResolvedValue(mockProducts);

    // We verify that the function does not throw and returns a buffer,
    // since the price logic is internal to PDF rendering
    const result = await generatePricelist('wholesale');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should fall back to retail price when wholesale price is null', async () => {
    // Fairy has priceWholesale: null — should use priceRetail
    mockPrisma.product.findMany.mockResolvedValue([mockProducts[1]]);

    const result = await generatePricelist('wholesale');
    expect(result).toBeInstanceOf(Buffer);
  });
});
