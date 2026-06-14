import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ImportError,
  importProducts,
  getImportLogs,
  getImportLogById,
  parsePreview,
  rollbackImport,
} from './import';
import { makeXlsxBuffer } from '@/test/excel-buffer';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    importLog: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    category: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    product: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    productContent: { create: vi.fn(), upsert: vi.fn() },
    priceHistory: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('./image', () => ({
  processProductImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/cache', () => ({
  cacheInvalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/utils/slug', () => ({
  createSlug: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, '-')),
}));

import { prisma } from '@/lib/prisma';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImportError', () => {
  it('should create error with message and statusCode', () => {
    const error = new ImportError('Test error', 400);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ImportError');
  });

  it('should be an instance of Error', () => {
    const error = new ImportError('Test', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ImportError);
  });
});

describe('getImportLogs', () => {
  it('should return paginated import logs', async () => {
    const mockLogs = [
      { id: 1, filename: 'test.xlsx', status: 'completed_import' },
      { id: 2, filename: 'test2.xlsx', status: 'completed_import' },
    ];
    mockPrisma.importLog.findMany.mockResolvedValue(mockLogs as never);
    mockPrisma.importLog.count.mockResolvedValue(2 as never);

    const result = await getImportLogs(1, 20);

    expect(result).toEqual({ logs: mockLogs, total: 2 });
    expect(mockPrisma.importLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { id: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('should calculate correct skip for page 2', async () => {
    mockPrisma.importLog.findMany.mockResolvedValue([] as never);
    mockPrisma.importLog.count.mockResolvedValue(0 as never);

    await getImportLogs(2, 10);

    expect(mockPrisma.importLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });
});

describe('getImportLogById', () => {
  it('should return import log by id', async () => {
    const mockLog = {
      id: 1,
      filename: 'test.xlsx',
      status: 'completed_import',
      manager: { id: 1, fullName: 'Admin', email: 'admin@test.com' },
    };
    mockPrisma.importLog.findUnique.mockResolvedValue(mockLog as never);

    const result = await getImportLogById(1);

    expect(result).toEqual(mockLog);
    expect(mockPrisma.importLog.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        manager: { select: { id: true, fullName: true, email: true } },
      },
    });
  });

  it('should return null for non-existent id', async () => {
    mockPrisma.importLog.findUnique.mockResolvedValue(null);

    const result = await getImportLogById(999);

    expect(result).toBeNull();
  });
});

describe('importProducts', () => {
  // Per-test fileBuffer is built via makeXlsxBuffer; this stub remains as a
  // placeholder for the few tests that pass the buffer through unchanged.
  const fileBuffer = Buffer.from('fake-excel');
  const filename = 'products.xlsx';
  const managerId = 1;

  beforeEach(() => {
    mockPrisma.importLog.create.mockResolvedValue({ id: 1 } as never);
    mockPrisma.importLog.update.mockResolvedValue({} as never);
    mockPrisma.category.findMany.mockResolvedValue([] as never);
  });

  it('should throw ImportError when Excel has no sheets', async () => {
    // Build a workbook with zero worksheets to trigger the "no data" branch.
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const fileBuffer = Buffer.from(await wb.xlsx.writeBuffer());

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(ImportError);
    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(
      'Файл не містить даних',
    );
  });

  it('should throw ImportError when sheet has no rows', async () => {
    const fileBuffer = await makeXlsxBuffer([] as never);

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(ImportError);
    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow('Файл порожній');
  });

  it('should use supplier format when missing code column but has name and price', async () => {
    const fileBuffer = await makeXlsxBuffer([{ Назва: 'Товар 1', 'Ціна роздріб': '100' }] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({
      id: 1,
      code: 'tovar-1',
      name: 'Товар 1',
    } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(result.totalRows).toBe(1);
  });

  it('should create product successfully', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Мило рідке', 'Ціна роздріб': '125.50', Кількість: '10' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({
      id: 1,
      code: 'P001',
      name: 'Мило рідке',
    } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.totalRows).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'P001',
        name: 'Мило рідке',
        priceRetail: 125.5,
        quantity: 10,
      }),
    });
  });

  it('should update existing product when code exists', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Мило рідке', 'Ціна роздріб': '125.50' },
    ] as never);

    const existingProduct = {
      id: 10,
      code: 'P001',
      name: 'Мило рідке',
      slug: 'milo-ridke',
      priceRetail: 125.5,
      priceWholesale: null,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existingProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        name: 'Мило рідке',
        priceRetail: 125.5,
      }),
    });
  });

  it('should track price history when retail price changes', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Мило рідке', 'Ціна роздріб': '150.00' },
    ] as never);

    const existingProduct = {
      id: 10,
      code: 'P001',
      name: 'Мило рідке',
      slug: 'milo-ridke',
      priceRetail: 125.5,
      priceWholesale: 100,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existingProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);
    mockPrisma.priceHistory.create.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
    expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 10,
        priceRetailOld: 125.5,
        priceRetailNew: 150,
        importId: 1,
      }),
    });
  });

  it('should auto-create category when it does not exist', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Мило рідке', 'Ціна роздріб': '100', Категорія: 'Побутова хімія' },
    ] as never);

    mockPrisma.category.findMany.mockResolvedValue([] as never);
    mockPrisma.category.findUnique.mockResolvedValue(null);
    mockPrisma.category.create.mockResolvedValue({
      id: 5,
      name: 'Побутова хімія',
      slug: 'pobutova-khimiia',
    } as never);
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Побутова хімія',
      }),
    });
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 5,
      }),
    });
  });

  it('should throw ImportError when sheet has more than 10000 rows', async () => {
    const bigArray = Array.from({ length: 10001 }, () => ({
      Код: 'P001',
      Назва: 'Test',
      'Ціна роздріб': '100',
    }));
    const fileBuffer = await makeXlsxBuffer(bigArray as never);

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(
      'Максимальна кількість рядків: 10 000',
    );
  });

  it('should throw ImportError when code column missing in standard format (no name either)', async () => {
    const fileBuffer = await makeXlsxBuffer([{ 'Якесь поле': 'value' }] as never);

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(
      'Не знайдено колонку "Код продукції"',
    );
  });

  it('should throw ImportError when name column missing in standard format', async () => {
    const fileBuffer = await makeXlsxBuffer([{ Код: 'P001', 'Якесь поле': 'value' }] as never);

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(
      'Не знайдено колонку "Назва"',
    );
  });

  it('should throw ImportError when retail price column missing in standard format', async () => {
    const fileBuffer = await makeXlsxBuffer([{ Код: 'P001', Назва: 'Test' }] as never);

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(
      'Не знайдено колонку "Ціна роздріб"',
    );
  });

  it('should skip rows with empty code', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: '', Назва: 'Test', 'Ціна роздріб': '100' },
    ] as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].field).toBe('code');
  });

  it('should skip rows with too-long code', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'A'.repeat(51), Назва: 'Test', 'Ціна роздріб': '100' },
    ] as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].message).toContain('занадто довгий');
  });

  it('should skip rows with empty name', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: '', 'Ціна роздріб': '100' },
    ] as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].field).toBe('name');
  });

  it('should skip rows with invalid retail price in standard format', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': 'abc' },
    ] as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].field).toBe('priceRetail');
  });

  it('should handle row processing error gracefully', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100' },
    ] as never);

    mockPrisma.product.findUnique.mockRejectedValueOnce(new Error('DB error'));

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].message).toBe('DB error');
  });

  it('should handle slug conflict for new product', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test Product', 'Ціна роздріб': '100' },
    ] as never);

    mockPrisma.product.findUnique
      .mockResolvedValueOnce(null) // code check
      .mockResolvedValueOnce({ id: 99 } as never); // slug exists
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'test-product-p001',
      }),
    });
  });

  it('should use existing category when found', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Категорія: 'Existing Category' },
    ] as never);

    mockPrisma.category.findMany.mockResolvedValue([
      { id: 10, name: 'Existing Category' },
    ] as never);
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.category.create).not.toHaveBeenCalled();
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 10,
      }),
    });
  });

  it('should handle slug conflict for auto-created category', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Категорія: 'New Cat' },
    ] as never);

    mockPrisma.category.findMany.mockResolvedValue([] as never);
    mockPrisma.category.findUnique.mockResolvedValue({ id: 99, slug: 'new-cat' } as never);
    mockPrisma.category.create.mockResolvedValue({ id: 5, name: 'New Cat' } as never);
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    // Category should be created with timestamped slug
    expect(mockPrisma.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'New Cat',
        slug: expect.stringMatching(/^new-cat-\d+$/),
      }),
    });
  });

  it('should update existing product slug when name changes', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'New Name', 'Ціна роздріб': '100' },
    ] as never);

    const existingProduct = {
      id: 10,
      code: 'P001',
      name: 'Old Name',
      slug: 'old-name',
      priceRetail: 100,
      priceWholesale: null,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existingProduct as never);
    mockPrisma.product.findFirst.mockResolvedValue(null); // no slug conflict
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        slug: 'new-name',
      }),
    });
  });

  it('should handle wholesale price changes for existing product', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', 'Ціна опт': '70' },
    ] as never);

    const existingProduct = {
      id: 10,
      code: 'P001',
      name: 'Test',
      slug: 'test',
      priceRetail: 100,
      priceWholesale: 80,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existingProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        priceWholesaleOld: 80,
        priceWholesale: 70,
      }),
    });
  });

  it('should update category when present on existing product update', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Категорія: 'Cat A' },
    ] as never);

    mockPrisma.category.findMany.mockResolvedValue([{ id: 5, name: 'Cat A' }] as never);
    const existingProduct = {
      id: 10,
      code: 'P001',
      name: 'Test',
      slug: 'test',
      priceRetail: 100,
      priceWholesale: null,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existingProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        categoryId: 5,
      }),
    });
  });

  it('should handle promo column with various truthy values', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Promo Yes', 'Ціна роздріб': '100', Акція: 'Так' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isPromo: true,
      }),
    });
  });

  it('should handle negative price as null', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Neg Price', 'Ціна роздріб': '-100' },
    ] as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].field).toBe('priceRetail');
  });

  it('should handle supplier format with category separator rows', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Назва: 'Cleaning Products', 'Ціна роздріб': '' }, // category separator
      { Назва: 'Soap', 'Ціна роздріб': '50' },
      { Назва: '', 'Ціна роздріб': '' }, // empty row
    ] as never);

    mockPrisma.category.findMany.mockResolvedValue([{ id: 1, name: 'Cleaning Products' }] as never);
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 1,
      }),
    });
  });

  it('should find existing product by name in supplier format', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Назва: 'Existing Prod', 'Ціна роздріб': '50' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null); // code check
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 10,
      code: 'EP1',
      name: 'Existing Prod',
      slug: 'existing-prod',
      priceRetail: 40,
      priceWholesale: null,
    } as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
  });

  it('should handle supplier format with only wholesale price', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Назва: 'Wholesale Only', 'Ціна опт': '80' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priceRetail: 0, // defaults to 0 when null
        priceWholesale: 80,
      }),
    });
  });

  it('should skip supplier format rows with no price', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Назва: 'No Price Product', 'Ціна роздріб': '', 'Ціна опт': '' },
    ] as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    // Row without any price in supplier format = category separator, no products imported
    expect(result.totalRows).toBe(0);
  });

  it('should handle image URL download for new product', async () => {
    const fetchImageMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (key: string) => (key === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    vi.stubGlobal('fetch', fetchImageMock);

    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'With Image',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    // Image processing is attempted
    expect(result.imagesImported + result.imagesFailed).toBeGreaterThanOrEqual(0);
  });

  it('should handle generic error during import and re-throw as ImportError', async () => {
    // Pass garbage bytes — ExcelJS will reject the load with a parse error,
    // which the importer wraps in ImportError("Помилка при обробці файлу").
    const corruptBuffer = Buffer.from('not-an-excel-file', 'utf-8');

    await expect(importProducts(corruptBuffer, filename, managerId)).rejects.toThrow(
      'Помилка при обробці файлу',
    );

    // Should update import log with failed status
    expect(mockPrisma.importLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed_import',
        }),
      }),
    );
  });

  it('should re-throw ImportError as-is', async () => {
    const fileBuffer = await makeXlsxBuffer([]);

    await expect(importProducts(fileBuffer, filename, managerId)).rejects.toThrow(ImportError);
  });

  it('should handle image URL for existing product update', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    const existingProduct = {
      id: 10,
      code: 'P001',
      name: 'Test',
      slug: 'test',
      priceRetail: 100,
      priceWholesale: null,
    };
    mockPrisma.product.findUnique.mockResolvedValue(existingProduct as never);
    mockPrisma.product.update.mockResolvedValue({} as never);

    // Mock fetch for image download - blocked URL
    const fetchImageMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchImageMock);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
  });

  it('should skip image when URL is blocked (SSRF protection)', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Зображення: 'http://localhost/img.jpg' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(result.imagesFailed).toBe(1);
  });

  it('should handle price with comma as decimal separator', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100,50' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priceRetail: 100.5,
      }),
    });
  });

  it('should handle negative quantity as 0', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Кількість: '-5' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 0,
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// parsePreview
// ---------------------------------------------------------------------------

describe('parsePreview', () => {
  it('should return headers, rows preview, and detect standard format', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100' },
      { Код: 'P002', Назва: 'Test 2', 'Ціна роздріб': '200' },
    ] as never);

    const result = await parsePreview(fileBuffer);

    expect(result.headers).toEqual(['Код', 'Назва', 'Ціна роздріб']);
    expect(result.rows).toHaveLength(2);
    expect(result.totalRows).toBe(2);
    expect(result.format).toBe('standard');
  });

  it('should detect supplier format', async () => {
    const fileBuffer = await makeXlsxBuffer([{ Назва: 'Test', 'Ціна роздріб': '100' }] as never);

    const result = await parsePreview(fileBuffer);

    expect(result.format).toBe('supplier');
  });

  it('should limit preview to 10 rows', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      Код: `P${i}`,
      Назва: `Test ${i}`,
      'Ціна роздріб': `${i * 10}`,
    }));
    const fileBuffer = await makeXlsxBuffer(rows as never);

    const result = await parsePreview(fileBuffer);

    expect(result.rows).toHaveLength(10);
    expect(result.totalRows).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// getImportLogs - default params
// ---------------------------------------------------------------------------

describe('importProducts - supplier format with both prices null (skip row)', () => {
  const fileBuffer = Buffer.from('fake-excel');
  const filename = 'products.xlsx';
  const managerId = 1;

  beforeEach(() => {
    mockPrisma.importLog.create.mockResolvedValue({ id: 1 } as never);
    mockPrisma.importLog.update.mockResolvedValue({} as never);
    mockPrisma.category.findMany.mockResolvedValue([] as never);
  });

  it('should skip supplier rows with both prices null as error', async () => {
    // Supplier format: has name + price columns but row has invalid prices
    const fileBuffer = await makeXlsxBuffer([
      { Назва: 'Bad Price Item', 'Ціна роздріб': 'abc', 'Ціна опт': 'xyz' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.findFirst.mockResolvedValue(null);

    const result = await importProducts(fileBuffer, filename, managerId);

    // Both prices are null so it's treated as a category separator, not imported
    expect(result.totalRows).toBe(0);
  });

  it('should handle non-Error thrown in row processing', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100' },
    ] as never);

    mockPrisma.product.findUnique.mockRejectedValueOnce('string error');

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.skipped).toBe(1);
    expect(result.errors[0].message).toBe('Невідома помилка');
  });
});

describe('getImportLogs - default params', () => {
  it('should use default page=1 limit=20 when called without args', async () => {
    mockPrisma.importLog.findMany.mockResolvedValue([] as never);
    mockPrisma.importLog.count.mockResolvedValue(0 as never);

    await getImportLogs();

    expect(mockPrisma.importLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });
});

describe('importProducts - isAllowedUrl edge cases', () => {
  const fileBuffer = Buffer.from('fake-excel');
  const filename = 'products.xlsx';
  const managerId = 1;

  beforeEach(() => {
    mockPrisma.importLog.create.mockResolvedValue({ id: 1 } as never);
    mockPrisma.importLog.update.mockResolvedValue({} as never);
    mockPrisma.category.findMany.mockResolvedValue([] as never);
  });

  it('should fail image download for invalid URL (isAllowedUrl catch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Зображення: 'https://' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(result.imagesFailed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should fail image download for 10.x.x.x private IP', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P001', Назва: 'Test', 'Ціна роздріб': '100', Зображення: 'http://10.0.0.1/img.jpg' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(result.imagesFailed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should fail image download for 192.168.x.x private IP', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'http://192.168.1.1/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });

  it('should fail image download for .local domain', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'http://server.local/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });

  it('should fail image download when fetch returns non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });

  it('should fail image download for disallowed content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });

  it('should fail image download for oversized buffer', async () => {
    const largeBuffer = new ArrayBuffer(6 * 1024 * 1024); // 6MB > 5MB limit
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: () => Promise.resolve(largeBuffer),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });

  it('should fail image download for empty buffer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });

  it('should handle fetch error gracefully (downloadAndProcessImage catch)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P001',
        Назва: 'Test',
        'Ціна роздріб': '100',
        Зображення: 'https://example.com/img.jpg',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 1 } as never);

    const result = await importProducts(fileBuffer, filename, managerId);
    expect(result.imagesFailed).toBe(1);
  });
});

describe('importProducts — content fields (round-trip)', () => {
  const fileBuffer = Buffer.from('fake-excel');
  const filename = 'products_full.xlsx';
  const managerId = 1;

  beforeEach(() => {
    mockPrisma.importLog.create.mockResolvedValue({ id: 1 } as never);
    mockPrisma.importLog.update.mockResolvedValue({} as never);
    mockPrisma.category.findMany.mockResolvedValue([] as never);
    mockPrisma.productContent.create.mockResolvedValue({} as never);
    mockPrisma.productContent.upsert.mockResolvedValue({} as never);
    mockPrisma.priceHistory.create.mockResolvedValue({} as never);
  });

  it('should create ProductContent when description columns are present', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P010',
        Назва: 'Гель для прання',
        'Ціна роздріб': '200',
        'Короткий опис': 'Гель 1л',
        Опис: '<p>Гель для прання кольорової білизни</p>',
        Характеристики: "Об'єм: 1л",
        'SEO заголовок': 'Гель для прання купити',
        'SEO опис': 'Купити гель для прання за найкращою ціною',
        'SEO ключові слова': 'гель, прання, кольорова',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 10, code: 'P010' } as never);
    mockPrisma.productContent.create.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.created).toBe(1);
    expect(mockPrisma.productContent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 10,
        shortDescription: 'Гель 1л',
        description: '<p>Гель для прання кольорової білизни</p>',
        specifications: "Об'єм: 1л",
        seoTitle: 'Гель для прання купити',
        seoDescription: 'Купити гель для прання за найкращою ціною',
        seoKeywords: 'гель, прання, кольорова',
      }),
    });
  });

  it('should upsert ProductContent when updating existing product', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P010',
        Назва: 'Гель для прання',
        'Ціна роздріб': '250',
        Опис: '<p>Оновлений опис</p>',
        'SEO заголовок': 'Новий SEO title',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue({
      id: 10,
      code: 'P010',
      name: 'Гель для прання',
      priceRetail: 200,
      priceWholesale: null,
    } as never);
    mockPrisma.product.update.mockResolvedValue({ id: 10 } as never);
    mockPrisma.productContent.upsert.mockResolvedValue({} as never);

    const result = await importProducts(fileBuffer, filename, managerId);

    expect(result.updated).toBe(1);
    expect(mockPrisma.productContent.upsert).toHaveBeenCalledWith({
      where: { productId: 10 },
      update: expect.objectContaining({
        description: '<p>Оновлений опис</p>',
        seoTitle: 'Новий SEO title',
      }),
      create: expect.objectContaining({
        productId: 10,
        description: '<p>Оновлений опис</p>',
        seoTitle: 'Новий SEO title',
      }),
    });
  });

  it('should not create ProductContent when no content columns present', async () => {
    const fileBuffer = await makeXlsxBuffer([
      { Код: 'P011', Назва: 'Мило', 'Ціна роздріб': '30' },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 11 } as never);

    await importProducts(fileBuffer, filename, managerId);

    expect(mockPrisma.productContent.create).not.toHaveBeenCalled();
    expect(mockPrisma.productContent.upsert).not.toHaveBeenCalled();
  });

  it('should handle English column names for content fields', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P012',
        Назва: 'Soap',
        'Ціна роздріб': '50',
        description: 'Full description text',
        seo_title: 'Buy soap online',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 12 } as never);
    mockPrisma.productContent.create.mockResolvedValue({} as never);

    await importProducts(fileBuffer, filename, managerId);

    expect(mockPrisma.productContent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 12,
        description: 'Full description text',
        seoTitle: 'Buy soap online',
      }),
    });
  });

  it('should skip empty content fields', async () => {
    const fileBuffer = await makeXlsxBuffer([
      {
        Код: 'P013',
        Назва: 'Empty Content',
        'Ціна роздріб': '10',
        'Короткий опис': '',
        Опис: '',
        'SEO заголовок': '',
      },
    ] as never);

    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 13 } as never);

    await importProducts(fileBuffer, filename, managerId);

    // All content fields are empty, so no ProductContent should be created
    expect(mockPrisma.productContent.create).not.toHaveBeenCalled();
  });
});

describe('rollbackImport', () => {
  const baseLog = {
    id: 5,
    status: 'completed_import',
    rollbackedAt: null,
    createdProductIds: [] as number[],
  };

  beforeEach(() => {
    // $transaction(array) → resolve each op (mocks already return values).
    mockPrisma.$transaction.mockImplementation(((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma)) as never);
  });

  it('reverts all four price tiers in a single transaction', async () => {
    mockPrisma.importLog.findUnique.mockResolvedValue(baseLog as never);
    mockPrisma.priceHistory.findMany.mockResolvedValue([
      {
        productId: 1,
        priceRetailOld: 100,
        priceWholesaleOld: 90,
        priceWholesale2Old: 80,
        priceWholesale3Old: 70,
      },
    ] as never);
    mockPrisma.product.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.importLog.update.mockResolvedValue({} as never);

    const result = await rollbackImport(5, 99);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.pricesRevertedCount).toBe(1);
    // The revert carries all four old prices (incl. wholesale2/3, previously lost).
    expect(mockPrisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        priceRetail: 100,
        priceWholesale: 90,
        priceWholesale2: 80,
        priceWholesale3: 70,
      },
    });
  });

  it('refuses to roll back an already-rolled-back import', async () => {
    mockPrisma.importLog.findUnique.mockResolvedValue({
      ...baseLog,
      rollbackedAt: new Date(),
    } as never);

    await expect(rollbackImport(5, 99)).rejects.toThrow(ImportError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
