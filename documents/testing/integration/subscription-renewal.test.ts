import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { processSubscriptionOrders } from '@/services/jobs/process-subscriptions';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Subscription auto-renewal (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let productA: Awaited<ReturnType<typeof createTestProduct>>;
  let productB: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    user = await createTestUser({
      fullName: 'Підписник Тест',
      phone: '+380991112233',
    });
    productA = await createTestProduct({
      name: 'Мило рідке',
      priceRetail: 55.0,
      quantity: 200,
    });
    productB = await createTestProduct({
      name: 'Кондиціонер для білизни',
      priceRetail: 120.0,
      quantity: 100,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create an order for a due subscription and advance nextDeliveryAt', async () => {
    // Create subscription with nextDeliveryAt in the past
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        frequency: 'monthly',
        status: 'active',
        nextDeliveryAt: pastDate,
        discountPercent: 5,
        deliveryMethod: 'nova_poshta',
        deliveryCity: 'Київ',
        deliveryAddress: 'вул. Тестова 1',
        paymentMethod: 'bank_transfer',
        items: {
          create: [
            { productId: productA.id, quantity: 4 },
            { productId: productB.id, quantity: 1 },
          ],
        },
      },
    });

    // Run the subscription processor
    const result = await processSubscriptionOrders();

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    // Verify a new order was created
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    expect(orders.length).toBeGreaterThanOrEqual(1);

    const latestOrder = orders[0];
    expect(latestOrder.status).toBe('new_order');
    expect(latestOrder.contactName).toBe('Підписник Тест');

    // Verify order items match subscription items
    expect(latestOrder.items).toHaveLength(2);
    const itemA = latestOrder.items.find((i) => i.productId === productA.id);
    const itemB = latestOrder.items.find((i) => i.productId === productB.id);
    expect(itemA).toBeDefined();
    expect(itemA!.quantity).toBe(4);
    expect(itemB).toBeDefined();
    expect(itemB!.quantity).toBe(1);

    // Verify subscription discount was applied
    // Items total: 4 * 55 + 1 * 120 = 340
    // Discount: 340 * 5% = 17.00
    // After discount: 323.00
    const itemsTotal = 4 * 55 + 1 * 120;
    const discountAmount = Math.round(itemsTotal * 5 * 100) / 10000;
    const roundedDiscount = Math.round(discountAmount * 100) / 100;

    // Re-read the order to get the updated amounts
    const updatedOrder = await prisma.order.findUnique({
      where: { id: latestOrder.id },
    });

    expect(Number(updatedOrder!.discountAmount)).toBeCloseTo(roundedDiscount, 2);
    expect(Number(updatedOrder!.totalAmount)).toBeCloseTo(
      Math.max(0, Math.round((itemsTotal - roundedDiscount) * 100) / 100),
      2
    );

    // Verify nextDeliveryAt was advanced (should be ~30 days from now)
    const updatedSub = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });

    expect(updatedSub).not.toBeNull();
    expect(updatedSub!.nextDeliveryAt.getTime()).toBeGreaterThan(Date.now());

    // Should be approximately 30 days from now (within 1 hour tolerance)
    const expectedNextDelivery = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(updatedSub!.nextDeliveryAt.getTime()).toBeCloseTo(expectedNextDelivery, -4); // ~hour tolerance

    // Verify lastOrderId was set
    expect(updatedSub!.lastOrderId).toBe(latestOrder.id);
  });

  it('should skip paused subscriptions', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        frequency: 'weekly',
        status: 'paused',
        nextDeliveryAt: pastDate,
        pausedAt: new Date(),
        items: {
          create: [{ productId: productA.id, quantity: 1 }],
        },
      },
    });

    const ordersBefore = await prisma.order.count({ where: { userId: user.id } });
    await processSubscriptionOrders();
    const ordersAfter = await prisma.order.count({ where: { userId: user.id } });

    // No new orders should be created for paused subscriptions
    // (the active one from the previous test is not due anymore, so count should stay the same)
    expect(ordersAfter).toBe(ordersBefore);
  });

  it('should skip subscriptions with no available products', async () => {
    // Create a product with zero stock
    const outOfStockProduct = await createTestProduct({
      name: 'Товар без залишків',
      quantity: 0,
    });

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        frequency: 'weekly',
        status: 'active',
        nextDeliveryAt: pastDate,
        items: {
          create: [{ productId: outOfStockProduct.id, quantity: 10 }],
        },
      },
    });

    const result = await processSubscriptionOrders();
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });
});
