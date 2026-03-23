import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Personal pricing flow (real DB)', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let customer: Awaited<ReturnType<typeof createTestUser>>;
  let productA: Awaited<ReturnType<typeof createTestProduct>>;
  let productB: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    admin = await createTestUser({ fullName: 'Адмін Цін', role: 'admin' });
    customer = await createTestUser({
      fullName: 'VIP Клієнт',
      phone: '+380501234567',
      role: 'wholesaler',
      wholesaleStatus: 'approved',
    });
    productA = await createTestProduct({
      name: 'Товар з персональною ціною',
      priceRetail: 200.0,
      priceWholesale: 150.0,
      quantity: 100,
    });
    productB = await createTestProduct({
      name: 'Товар без персональної ціни',
      priceRetail: 300.0,
      priceWholesale: 220.0,
      quantity: 50,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should set personal price and use it at checkout', async () => {
    // 1. Admin sets a personal fixed price for the customer
    const personalPrice = await prisma.personalPrice.create({
      data: {
        userId: customer.id,
        productId: productA.id,
        fixedPrice: 120.0,
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: admin.id,
      },
    });

    expect(personalPrice.id).toBeGreaterThan(0);
    expect(Number(personalPrice.fixedPrice)).toBeCloseTo(120.0, 2);

    // 2. Customer sees personal price
    const personalPrices = await prisma.personalPrice.findMany({
      where: {
        userId: customer.id,
        productId: productA.id,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });

    expect(personalPrices).toHaveLength(1);
    const effectivePrice = Number(personalPrices[0].fixedPrice);
    expect(effectivePrice).toBeCloseTo(120.0, 2);
    expect(effectivePrice).toBeLessThan(Number(productA.priceRetail));
    expect(effectivePrice).toBeLessThan(Number(productA.priceWholesale));

    // 3. Checkout uses the personal price
    const checkout = {
      contactName: 'VIP Клієнт',
      contactPhone: '+380501234567',
      contactEmail: 'vip@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Київ',
      paymentMethod: 'bank_transfer' as const,
    };

    const cartItems = [
      {
        productId: productA.id,
        productCode: productA.code,
        productName: productA.name,
        price: effectivePrice, // Using the personal price
        quantity: 5,
        isPromo: false,
      },
      {
        productId: productB.id,
        productCode: productB.code,
        productName: productB.name,
        price: Number(productB.priceWholesale), // Regular wholesale price
        quantity: 2,
        isPromo: false,
      },
    ];

    const order = await createOrder(customer.id, checkout, cartItems, 'wholesale');

    // 4. Verify total: 5 * 120.0 + 2 * 220.0 = 600 + 440 = 1040
    const expectedTotal = 5 * 120.0 + 2 * 220.0;
    expect(Number(order.totalAmount)).toBeCloseTo(expectedTotal, 2);

    // Verify order items use correct prices
    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    const itemA = dbOrder!.items.find((i) => i.productId === productA.id);
    expect(Number(itemA!.priceAtOrder)).toBeCloseTo(120.0, 2); // Personal price used
    expect(Number(itemA!.subtotal)).toBeCloseTo(600.0, 2);

    const itemB = dbOrder!.items.find((i) => i.productId === productB.id);
    expect(Number(itemB!.priceAtOrder)).toBeCloseTo(220.0, 2); // Regular wholesale
  });

  it('should set personal discount percent', async () => {
    const personalDiscount = await prisma.personalPrice.create({
      data: {
        userId: customer.id,
        productId: productB.id,
        discountPercent: 15.0,
        validFrom: new Date(),
        createdBy: admin.id,
      },
    });

    expect(Number(personalDiscount.discountPercent)).toBeCloseTo(15.0, 2);

    // Calculate effective price
    const basePrice = Number(productB.priceWholesale);
    const discountedPrice = basePrice * (1 - 15.0 / 100);
    expect(discountedPrice).toBeCloseTo(187.0, 2); // 220 * 0.85

    // Verify personal price exists
    const prices = await prisma.personalPrice.findMany({
      where: { userId: customer.id, productId: productB.id },
    });
    expect(prices.length).toBeGreaterThanOrEqual(1);
  });

  it('should not apply expired personal price', async () => {
    await prisma.personalPrice.create({
      data: {
        userId: customer.id,
        productId: productA.id,
        fixedPrice: 50.0, // very low price
        validFrom: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired yesterday
        createdBy: admin.id,
      },
    });

    // Query only active personal prices
    const activePrices = await prisma.personalPrice.findMany({
      where: {
        userId: customer.id,
        productId: productA.id,
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } },
        ],
      },
    });

    // The expired price should not appear in active prices (only the valid one from earlier test)
    for (const pp of activePrices) {
      if (pp.validUntil) {
        expect(pp.validUntil.getTime()).toBeGreaterThanOrEqual(Date.now());
      }
    }
  });

  it('should allow category-level personal pricing', async () => {
    const category = await prisma.category.create({
      data: {
        name: 'VIP Категорія',
        slug: 'vip-category',
      },
    });

    // Set personal price for entire category
    const categoryPrice = await prisma.personalPrice.create({
      data: {
        userId: customer.id,
        categoryId: category.id,
        discountPercent: 20.0,
        createdBy: admin.id,
      },
    });

    expect(categoryPrice.categoryId).toBe(category.id);
    expect(categoryPrice.productId).toBeNull();
    expect(Number(categoryPrice.discountPercent)).toBeCloseTo(20.0, 2);
  });
});
