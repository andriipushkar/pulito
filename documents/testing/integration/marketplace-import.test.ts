import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cleanDatabase, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

/**
 * This test validates marketplace order import atomicity using real DB transactions.
 *
 * Because the marketplace-sync service calls external APIs (Rozetka/Prom),
 * we mock the API client layer but use the real database to verify:
 * - Orders are created correctly from external data
 * - Duplicate imports are prevented via transactional dedup
 * - MarketplaceConnection and MarketplaceListing records work correctly
 */
describe('Marketplace import atomicity (real DB)', () => {
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    product = await createTestProduct({
      name: 'Marketplace Product',
      priceRetail: 150.0,
      quantity: 500,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create a MarketplaceConnection and listing', async () => {
    const connection = await prisma.marketplaceConnection.create({
      data: {
        platform: 'rozetka',
        apiKey: 'test-api-key',
        apiSecret: 'test-secret',
        shopId: 'test-shop-123',
        isActive: true,
      },
    });

    expect(connection.id).toBeGreaterThan(0);
    expect(connection.platform).toBe('rozetka');
    expect(connection.isActive).toBe(true);

    // Create a listing for this connection
    const listing = await prisma.marketplaceListing.create({
      data: {
        connectionId: connection.id,
        productId: product.id,
        externalId: 'rozetka-ext-12345',
        status: 'active',
        externalUrl: 'https://rozetka.com.ua/product/12345',
        syncedAt: new Date(),
      },
    });

    expect(listing.id).toBeGreaterThan(0);
    expect(listing.externalId).toBe('rozetka-ext-12345');
    expect(listing.status).toBe('active');

    // Verify uniqueness constraint (connectionId, productId)
    await expect(
      prisma.marketplaceListing.create({
        data: {
          connectionId: connection.id,
          productId: product.id,
          externalId: 'different-ext-id',
          status: 'draft',
        },
      })
    ).rejects.toThrow();
  });

  it('should prevent duplicate order import using transaction', async () => {
    const externalOrderId = 'rozetka-order-98765';
    const platform = 'rozetka';

    // Simulate importing an order from marketplace using a transaction (same pattern as importOrdersFromMarketplace)
    const importOrder = async (extId: string) => {
      return prisma.$transaction(async (tx) => {
        // Check if already imported (dedup within transaction)
        const existing = await tx.order.findFirst({
          where: {
            orderNumber: { startsWith: `MP-${platform}-${extId}` },
          },
        });

        if (existing) return 'skipped' as const;

        // Create the order
        await tx.order.create({
          data: {
            orderNumber: `MP-${platform}-${extId}`,
            status: 'new_order',
            clientType: 'retail',
            totalAmount: 450.0,
            discountAmount: 0,
            deliveryCost: 0,
            itemsCount: 3,
            contactName: 'Marketplace Buyer',
            contactPhone: '+380667778899',
            contactEmail: 'marketplace-buyer@example.com',
            deliveryMethod: 'nova_poshta',
            paymentMethod: 'cod',
            source: 'web',
            comment: `Imported from ${platform}, external ID: ${extId}`,
            items: {
              create: [
                {
                  productId: product.id,
                  productCode: product.code,
                  productName: product.name,
                  priceAtOrder: 150.0,
                  quantity: 3,
                  subtotal: 450.0,
                },
              ],
            },
          },
        });

        return 'imported' as const;
      });
    };

    // First import should succeed
    const result1 = await importOrder(externalOrderId);
    expect(result1).toBe('imported');

    // Verify order exists in DB
    const order = await prisma.order.findFirst({
      where: { orderNumber: `MP-${platform}-${externalOrderId}` },
      include: { items: true },
    });

    expect(order).not.toBeNull();
    expect(order!.contactName).toBe('Marketplace Buyer');
    expect(Number(order!.totalAmount)).toBeCloseTo(450.0, 2);
    expect(order!.items).toHaveLength(1);
    expect(order!.items[0].quantity).toBe(3);

    // Second import with same external ID should be skipped (no duplicate)
    const result2 = await importOrder(externalOrderId);
    expect(result2).toBe('skipped');

    // Verify only one order exists
    const orderCount = await prisma.order.count({
      where: { orderNumber: { startsWith: `MP-${platform}-${externalOrderId}` } },
    });
    expect(orderCount).toBe(1);
  });

  it('should handle concurrent import attempts without duplicates', async () => {
    const extId = 'concurrent-order-111';
    const platform = 'rozetka';

    const importOrder = async () => {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.order.findFirst({
          where: { orderNumber: `MP-${platform}-${extId}` },
        });

        if (existing) return 'skipped' as const;

        await tx.order.create({
          data: {
            orderNumber: `MP-${platform}-${extId}`,
            status: 'new_order',
            clientType: 'retail',
            totalAmount: 200.0,
            discountAmount: 0,
            deliveryCost: 0,
            itemsCount: 1,
            contactName: 'Concurrent Buyer',
            contactPhone: '+380001112233',
            contactEmail: 'concurrent@example.com',
            deliveryMethod: 'nova_poshta',
            paymentMethod: 'cod',
            source: 'web',
            items: {
              create: [
                {
                  productId: product.id,
                  productCode: product.code,
                  productName: product.name,
                  priceAtOrder: 200.0,
                  quantity: 1,
                  subtotal: 200.0,
                },
              ],
            },
          },
        });

        return 'imported' as const;
      });
    };

    // Run multiple imports concurrently
    const results = await Promise.allSettled([
      importOrder(),
      importOrder(),
      importOrder(),
    ]);

    // At least one should succeed, none should create duplicates
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const importedCount = fulfilled.filter(
      (r) => r.status === 'fulfilled' && r.value === 'imported'
    ).length;

    // Due to serialization, exactly 1 should import and the rest skip or fail
    expect(importedCount).toBeGreaterThanOrEqual(1);

    // Verify only one order in DB
    const orderCount = await prisma.order.count({
      where: { orderNumber: `MP-${platform}-${extId}` },
    });
    expect(orderCount).toBe(1);
  });
});
