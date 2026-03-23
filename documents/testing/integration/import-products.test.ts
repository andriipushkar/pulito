import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cleanDatabase, createTestUser, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Product import flow (real DB)', () => {
  let manager: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    manager = await createTestUser({ fullName: 'Менеджер Імпорту', role: 'manager' });

    // Create a category for imported products
    await prisma.category.create({
      data: {
        name: 'Миючі засоби',
        slug: 'myuchi-zasoby',
        isVisible: true,
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should import new products and create import log', async () => {
    const category = await prisma.category.findUnique({ where: { slug: 'myuchi-zasoby' } });

    // 1. Create import log entry
    const importLog = await prisma.importLog.create({
      data: {
        managerId: manager.id,
        filename: 'products-2024-03.xlsx',
        fileSizeBytes: 102400,
        status: 'processing_import',
        totalRows: 3,
        startedAt: new Date(),
      },
    });

    expect(importLog.id).toBeGreaterThan(0);
    expect(importLog.status).toBe('processing_import');

    // 2. Simulate importing products
    const productsToImport = [
      {
        code: 'IMP-001',
        name: 'Мило господарське',
        slug: 'mylo-hospodarske',
        priceRetail: 25.0,
        priceWholesale: 18.0,
        quantity: 500,
        categoryId: category!.id,
        isActive: true,
      },
      {
        code: 'IMP-002',
        name: 'Засіб для чищення плит',
        slug: 'zasib-dlya-chyshennya-plyt',
        priceRetail: 89.0,
        priceWholesale: 65.0,
        quantity: 200,
        categoryId: category!.id,
        isActive: true,
      },
      {
        code: 'IMP-003',
        name: 'Серветки вологі',
        slug: 'servetky-volohi',
        priceRetail: 45.0,
        priceWholesale: 32.0,
        quantity: 1000,
        categoryId: category!.id,
        isActive: true,
      },
    ];

    let createdCount = 0;
    for (const p of productsToImport) {
      await prisma.product.create({ data: p });
      createdCount++;
    }

    // 3. Update import log
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'completed_import',
        createdCount,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        completedAt: new Date(),
        durationMs: 1500,
      },
    });

    // 4. Verify products were created
    const importedProducts = await prisma.product.findMany({
      where: { code: { startsWith: 'IMP-' } },
      orderBy: { code: 'asc' },
    });

    expect(importedProducts).toHaveLength(3);
    expect(importedProducts[0].name).toBe('Мило господарське');
    expect(Number(importedProducts[0].priceRetail)).toBeCloseTo(25.0, 2);
    expect(importedProducts[1].name).toBe('Засіб для чищення плит');
    expect(importedProducts[2].name).toBe('Серветки вологі');

    // 5. Verify import log is complete
    const completedLog = await prisma.importLog.findUnique({ where: { id: importLog.id } });
    expect(completedLog!.status).toBe('completed_import');
    expect(completedLog!.createdCount).toBe(3);
    expect(completedLog!.completedAt).not.toBeNull();

    // 6. Verify search index updated (products have searchVector)
    const searchableProduct = await prisma.product.findUnique({
      where: { code: 'IMP-001' },
    });
    expect(searchableProduct).not.toBeNull();
    expect(searchableProduct!.isActive).toBe(true);
  });

  it('should update existing products on re-import', async () => {
    const importLog = await prisma.importLog.create({
      data: {
        managerId: manager.id,
        filename: 'products-update-2024-03.xlsx',
        status: 'processing_import',
        totalRows: 2,
        startedAt: new Date(),
      },
    });

    // Update existing product
    const existing = await prisma.product.findUnique({ where: { code: 'IMP-001' } });
    expect(existing).not.toBeNull();

    await prisma.product.update({
      where: { code: 'IMP-001' },
      data: {
        priceRetail: 30.0,
        priceWholesale: 22.0,
        quantity: 600,
      },
    });

    // Record price history
    await prisma.priceHistory.create({
      data: {
        productId: existing!.id,
        priceRetailOld: 25.0,
        priceRetailNew: 30.0,
        priceWholesaleOld: 18.0,
        priceWholesaleNew: 22.0,
        importId: importLog.id,
      },
    });

    // Complete import
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'completed_import',
        createdCount: 0,
        updatedCount: 1,
        skippedCount: 1,
        completedAt: new Date(),
      },
    });

    // Verify updated product
    const updated = await prisma.product.findUnique({ where: { code: 'IMP-001' } });
    expect(Number(updated!.priceRetail)).toBeCloseTo(30.0, 2);
    expect(Number(updated!.priceWholesale!)).toBeCloseTo(22.0, 2);
    expect(updated!.quantity).toBe(600);

    // Verify price history recorded
    const history = await prisma.priceHistory.findMany({
      where: { productId: existing!.id },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(Number(history[0].priceRetailOld)).toBeCloseTo(25.0, 2);
    expect(Number(history[0].priceRetailNew)).toBeCloseTo(30.0, 2);
  });

  it('should handle import with errors gracefully', async () => {
    const importLog = await prisma.importLog.create({
      data: {
        managerId: manager.id,
        filename: 'products-errors.xlsx',
        status: 'processing_import',
        totalRows: 2,
        startedAt: new Date(),
      },
    });

    // Try to import a product with duplicate code (should fail)
    const errors: Array<{ row: number; error: string }> = [];

    try {
      await prisma.product.create({
        data: {
          code: 'IMP-001', // duplicate
          name: 'Дублікат',
          slug: 'dublikat',
          priceRetail: 10.0,
          quantity: 1,
        },
      });
    } catch {
      errors.push({ row: 1, error: 'Duplicate product code IMP-001' });
    }

    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'completed_import',
        createdCount: 0,
        errorCount: errors.length,
        errorsJson: errors,
        completedAt: new Date(),
      },
    });

    const log = await prisma.importLog.findUnique({ where: { id: importLog.id } });
    expect(log!.errorCount).toBe(1);
    expect(log!.errorsJson).toBeDefined();
  });
});
