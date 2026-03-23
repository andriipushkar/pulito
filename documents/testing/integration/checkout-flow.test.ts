import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Full checkout flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let productA: Awaited<ReturnType<typeof createTestProduct>>;
  let productB: Awaited<ReturnType<typeof createTestProduct>>;
  let productC: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    user = await createTestUser({ fullName: 'Покупець Тест', phone: '+380501234567' });
    productA = await createTestProduct({
      name: 'Засіб для миття посуду Fairy',
      priceRetail: 89.5,
      quantity: 100,
    });
    productB = await createTestProduct({
      name: 'Пральний порошок Ariel',
      priceRetail: 245.0,
      quantity: 30,
    });
    productC = await createTestProduct({
      name: 'Губки кухонні',
      priceRetail: 35.0,
      quantity: 200,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should add items to cart, checkout, and verify stock + order', async () => {
    // 1. Add items to cart
    await prisma.cartItem.createMany({
      data: [
        { userId: user.id, productId: productA.id, quantity: 3 },
        { userId: user.id, productId: productB.id, quantity: 2 },
        { userId: user.id, productId: productC.id, quantity: 5 },
      ],
    });

    // Verify cart items exist
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { product: true },
    });
    expect(cartItems).toHaveLength(3);

    // 2. Build checkout data from cart
    const checkout = {
      contactName: 'Покупець Тест',
      contactPhone: '+380501234567',
      contactEmail: 'buyer@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Київ',
      deliveryAddress: 'вул. Хрещатик 1',
      paymentMethod: 'cod' as const,
    };

    const orderItems = cartItems.map((ci) => ({
      productId: ci.product.id,
      productCode: ci.product.code,
      productName: ci.product.name,
      price: Number(ci.product.priceRetail),
      quantity: ci.quantity,
      isPromo: false,
    }));

    // 3. Create the order
    const order = await createOrder(user.id, checkout, orderItems, 'retail');

    expect(order).toBeDefined();
    expect(order.id).toBeGreaterThan(0);
    expect(order.orderNumber).toBeTruthy();
    expect(order.status).toBe('new_order');
    expect(order.contactName).toBe('Покупець Тест');

    // 4. Verify total: 3*89.50 + 2*245.00 + 5*35.00 = 268.50 + 490.00 + 175.00 = 933.50
    const expectedTotal = 3 * 89.5 + 2 * 245.0 + 5 * 35.0;
    expect(Number(order.totalAmount)).toBeCloseTo(expectedTotal, 2);
    expect(order.itemsCount).toBe(10); // 3 + 2 + 5

    // 5. Verify order items in DB
    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, statusHistory: true },
    });

    expect(dbOrder).not.toBeNull();
    expect(dbOrder!.items).toHaveLength(3);

    const itemA = dbOrder!.items.find((i) => i.productId === productA.id);
    expect(itemA).toBeDefined();
    expect(itemA!.quantity).toBe(3);
    expect(Number(itemA!.priceAtOrder)).toBeCloseTo(89.5, 2);
    expect(Number(itemA!.subtotal)).toBeCloseTo(268.5, 2);

    const itemB = dbOrder!.items.find((i) => i.productId === productB.id);
    expect(itemB).toBeDefined();
    expect(itemB!.quantity).toBe(2);
    expect(Number(itemB!.priceAtOrder)).toBeCloseTo(245.0, 2);

    const itemC = dbOrder!.items.find((i) => i.productId === productC.id);
    expect(itemC).toBeDefined();
    expect(itemC!.quantity).toBe(5);
    expect(Number(itemC!.priceAtOrder)).toBeCloseTo(35.0, 2);

    // 6. Verify product stock was decremented
    const updatedA = await prisma.product.findUnique({ where: { id: productA.id } });
    const updatedB = await prisma.product.findUnique({ where: { id: productB.id } });
    const updatedC = await prisma.product.findUnique({ where: { id: productC.id } });

    expect(updatedA!.quantity).toBe(100 - 3);
    expect(updatedB!.quantity).toBe(30 - 2);
    expect(updatedC!.quantity).toBe(200 - 5);

    // 7. Verify status history was created
    expect(dbOrder!.statusHistory).toHaveLength(1);
    expect(dbOrder!.statusHistory[0].newStatus).toBe('new_order');
    expect(dbOrder!.statusHistory[0].changeSource).toBe('system');
  });

  it('should create an order with guest (no userId)', async () => {
    const checkout = {
      contactName: 'Гість Покупець',
      contactPhone: '+380667778899',
      contactEmail: 'guest@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Одеса',
      deliveryAddress: 'вул. Дерибасівська 10',
      paymentMethod: 'online' as const,
    };

    const cartItems = [
      {
        productId: productA.id,
        productCode: productA.code,
        productName: productA.name,
        price: Number(productA.priceRetail),
        quantity: 1,
        isPromo: false,
      },
    ];

    const order = await createOrder(null, checkout, cartItems, 'retail');

    expect(order).toBeDefined();
    expect(order.userId).toBeNull();
    expect(order.contactName).toBe('Гість Покупець');
    expect(order.status).toBe('new_order');
  });

  it('should not allow checkout with out-of-stock product', async () => {
    const checkout = {
      contactName: 'Покупець',
      contactPhone: '+380501234567',
      contactEmail: 'buyer@test.com',
      deliveryMethod: 'nova_poshta' as const,
      paymentMethod: 'cod' as const,
    };

    const cartItems = [
      {
        productId: productB.id,
        productCode: productB.code,
        productName: productB.name,
        price: Number(productB.priceRetail),
        quantity: 99999,
        isPromo: false,
      },
    ];

    await expect(createOrder(user.id, checkout, cartItems, 'retail')).rejects.toThrow(
      /недоступний у потрібній кількості/i
    );
  });

  it('should not allow checkout with empty cart', async () => {
    const checkout = {
      contactName: 'Покупець',
      contactPhone: '+380501234567',
      contactEmail: 'buyer@test.com',
      deliveryMethod: 'nova_poshta' as const,
      paymentMethod: 'cod' as const,
    };

    await expect(createOrder(user.id, checkout, [], 'retail')).rejects.toThrow(/кошик порожній/i);
  });
});
