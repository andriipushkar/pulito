import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Order creation flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let productA: Awaited<ReturnType<typeof createTestProduct>>;
  let productB: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    user = await createTestUser();
    productA = await createTestProduct({
      name: 'Засіб для миття посуду',
      priceRetail: 89.5,
      quantity: 100,
    });
    productB = await createTestProduct({
      name: 'Пральний порошок',
      priceRetail: 245.0,
      quantity: 30,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create an order and decrement product quantities', async () => {
    const checkout = {
      contactName: 'Тестовий Покупець',
      contactPhone: '+380501234567',
      contactEmail: 'buyer@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Київ',
      deliveryAddress: 'вул. Хрещатик 1',
      paymentMethod: 'cod' as const,
    };

    const cartItems = [
      {
        productId: productA.id,
        productCode: productA.code,
        productName: productA.name,
        price: Number(productA.priceRetail),
        quantity: 3,
        isPromo: false,
      },
      {
        productId: productB.id,
        productCode: productB.code,
        productName: productB.name,
        price: Number(productB.priceRetail),
        quantity: 2,
        isPromo: false,
      },
    ];

    const order = await createOrder(user.id, checkout, cartItems, 'retail');

    // Verify order exists in DB
    expect(order).toBeDefined();
    expect(order.id).toBeGreaterThan(0);
    expect(order.orderNumber).toBeTruthy();
    expect(order.status).toBe('new_order');
    expect(order.contactName).toBe('Тестовий Покупець');

    // Verify total: 3 * 89.50 + 2 * 245.00 = 268.50 + 490.00 = 758.50
    const expectedTotal = 3 * 89.5 + 2 * 245.0;
    expect(Number(order.totalAmount)).toBeCloseTo(expectedTotal, 2);

    // Verify items count
    expect(order.itemsCount).toBe(5); // 3 + 2

    // Verify order items in DB
    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, statusHistory: true },
    });

    expect(dbOrder).not.toBeNull();
    expect(dbOrder!.items).toHaveLength(2);

    const itemA = dbOrder!.items.find((i) => i.productId === productA.id);
    const itemB = dbOrder!.items.find((i) => i.productId === productB.id);

    expect(itemA).toBeDefined();
    expect(itemA!.quantity).toBe(3);
    expect(Number(itemA!.priceAtOrder)).toBeCloseTo(89.5, 2);
    expect(Number(itemA!.subtotal)).toBeCloseTo(268.5, 2);

    expect(itemB).toBeDefined();
    expect(itemB!.quantity).toBe(2);
    expect(Number(itemB!.priceAtOrder)).toBeCloseTo(245.0, 2);
    expect(Number(itemB!.subtotal)).toBeCloseTo(490.0, 2);

    // Verify product quantities decremented
    const updatedProductA = await prisma.product.findUnique({ where: { id: productA.id } });
    const updatedProductB = await prisma.product.findUnique({ where: { id: productB.id } });

    expect(updatedProductA!.quantity).toBe(100 - 3);
    expect(updatedProductB!.quantity).toBe(30 - 2);

    // Verify status history was created
    expect(dbOrder!.statusHistory).toHaveLength(1);
    expect(dbOrder!.statusHistory[0].newStatus).toBe('new_order');
    expect(dbOrder!.statusHistory[0].changeSource).toBe('system');
  });

  it('should fail when product has insufficient stock', async () => {
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
        quantity: 9999,
        isPromo: false,
      },
    ];

    await expect(createOrder(user.id, checkout, cartItems, 'retail')).rejects.toThrow(
      /недоступний у потрібній кількості/i
    );
  });

  it('should reject an empty cart', async () => {
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
