import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockRename = vi.fn();
const mockMkdir = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findFirst: vi.fn(), update: vi.fn() },
    priceHistory: { create: vi.fn() },
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    mkdir: (...args: unknown[]) => mockMkdir(...args),
  },
}));

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { syncPricesFromFile, parsePriceCsv, parsePriceXlsx } from './price-sync';

const mockPrisma = prisma as unknown as {
  product: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  priceHistory: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined);
  mockRename.mockResolvedValue(undefined);
});

describe('parsePriceCsv', () => {
  it('should parse valid CSV with header row', () => {
    const csv = [
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3',
      'ABC-001,Product One,10,500,450,400,350',
      'ABC-002,Product Two,20,1000,900,800,700',
    ].join('\n');

    const entries = parsePriceCsv(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      code: 'ABC-001',
      name: 'Product One',
      priceRetail: 500,
      priceWholesale: 450,
      priceWholesale2: 400,
      priceWholesale3: 350,
    });
  });

  it('should skip rows without a code (category headers)', () => {
    const csv = [
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3',
      ',Category Header,,,,',
      'ABC-001,Product,10,500,450,400,350',
    ].join('\n');

    const entries = parsePriceCsv(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].code).toBe('ABC-001');
  });

  it('should skip rows with zero or NaN retail price', () => {
    const csv = [
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3',
      'ABC-001,Product,10,0,450,400,350',
      'ABC-002,Product,10,NaN,450,400,350',
      'ABC-003,Product,10,,450,400,350',
    ].join('\n');

    const entries = parsePriceCsv(csv);
    expect(entries).toHaveLength(0);
  });

  it('should handle optional wholesale prices (omit if zero or NaN)', () => {
    const csv = [
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3',
      'ABC-001,Product,10,500,,,',
    ].join('\n');

    const entries = parsePriceCsv(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].priceWholesale).toBeUndefined();
    expect(entries[0].priceWholesale2).toBeUndefined();
    expect(entries[0].priceWholesale3).toBeUndefined();
  });

  it('should handle quoted CSV fields containing commas', () => {
    const csv = [
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3',
      'ABC-001,"Product, special",10,500,450,400,350',
    ].join('\n');

    const entries = parsePriceCsv(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Product, special');
  });

  it('should return empty array for file with only header', () => {
    const csv = 'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3';
    const entries = parsePriceCsv(csv);
    expect(entries).toHaveLength(0);
  });

  it('should return empty array for empty content', () => {
    expect(parsePriceCsv('')).toHaveLength(0);
    expect(parsePriceCsv('\n')).toHaveLength(0);
  });
});

describe('syncPricesFromFile', () => {
  it('should return message when no price files found', async () => {
    mockReaddir.mockResolvedValue([]);
    const result = await syncPricesFromFile();
    expect(result).toEqual({ updated: 0, message: 'Файл з цінами не знайдено' });
  });

  it('should skip already processed files', async () => {
    mockReaddir.mockResolvedValue(['processed_12345_prices.csv']);
    const result = await syncPricesFromFile();
    expect(result).toEqual({ updated: 0, message: 'Файл з цінами не знайдено' });
  });

  it('should update product prices from CSV file', async () => {
    mockReaddir.mockResolvedValue(['prices.csv']);
    mockReadFile.mockResolvedValue(
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3\nABC-001,Product,10,500,450,400,350'
    );
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      priceRetail: 400,
      priceWholesale: 350,
      priceWholesale2: null,
      priceWholesale3: null,
    });
    mockPrisma.product.update.mockResolvedValue({});
    mockPrisma.priceHistory.create.mockResolvedValue({});

    const result = await syncPricesFromFile();

    expect(result.updated).toBe(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: expect.objectContaining({
        priceRetail: 500,
        priceRetailOld: 400,
        priceWholesale: 450,
        priceWholesale2: 400,
        priceWholesale3: 350,
      }),
    });
  });

  it('should record price history when price changes', async () => {
    mockReaddir.mockResolvedValue(['prices.csv']);
    mockReadFile.mockResolvedValue(
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3\nABC-001,Product,10,500,450,,\n'
    );
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      priceRetail: 400,
      priceWholesale: 350,
      priceWholesale2: null,
      priceWholesale3: null,
    });
    mockPrisma.product.update.mockResolvedValue({});
    mockPrisma.priceHistory.create.mockResolvedValue({});

    await syncPricesFromFile();

    expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'prod-1',
        priceRetailOld: '400',
        priceRetailNew: '500',
      }),
    });
  });

  it('should skip product not found in database', async () => {
    mockReaddir.mockResolvedValue(['prices.csv']);
    mockReadFile.mockResolvedValue(
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3\nXYZ-999,Unknown,10,500,450,400,350'
    );
    mockPrisma.product.findFirst.mockResolvedValue(null);

    const result = await syncPricesFromFile();

    expect(result.notFound).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('should archive file after processing', async () => {
    mockReaddir.mockResolvedValue(['prices.csv']);
    mockReadFile.mockResolvedValue(
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3\n'
    );

    await syncPricesFromFile();

    expect(mockRename).toHaveBeenCalledWith(
      expect.stringContaining('prices.csv'),
      expect.stringContaining('processed_'),
    );
  });

  it('should handle JSON price files', async () => {
    mockReaddir.mockResolvedValue(['prices.json']);
    mockReadFile.mockResolvedValue(
      JSON.stringify([{ code: 'ABC-001', priceRetail: 500 }])
    );
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      priceRetail: 400,
      priceWholesale: null,
      priceWholesale2: null,
      priceWholesale3: null,
    });
    mockPrisma.product.update.mockResolvedValue({});
    mockPrisma.priceHistory.create.mockResolvedValue({});

    const result = await syncPricesFromFile();

    expect(result.updated).toBe(1);
  });

  it('should count errors when product update throws', async () => {
    mockReaddir.mockResolvedValue(['prices.csv']);
    mockReadFile.mockResolvedValue(
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3\nABC-001,Product,10,500,450,400,350'
    );
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      priceRetail: 400,
      priceWholesale: null,
      priceWholesale2: null,
      priceWholesale3: null,
    });
    mockPrisma.product.update.mockRejectedValue(new Error('DB error'));

    const result = await syncPricesFromFile();

    expect(result.errors).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('should pick the latest file when multiple exist', async () => {
    mockReaddir.mockResolvedValue(['prices_a.csv', 'prices_b.csv']);
    mockReadFile.mockResolvedValue(
      'Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3\n'
    );

    await syncPricesFromFile();

    // After sort().reverse(), prices_b.csv comes first
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('prices_b.csv'),
      'utf-8',
    );
  });
});
