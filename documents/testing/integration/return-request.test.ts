import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Return request flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    admin = await createTestUser({ fullName: 'Адмін Повернень', role: 'admin' });
    user = await createTestUser({ fullName: 'Покупець Повернення', phone: '+380501234567' });
    product = await createTestProduct({
      name: 'Товар для повернення',
      priceRetail: 350.0,
      quantity: 50,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create order, request return, admin approves, refund processed', async () => {
    // 1. Create and complete an order
    const checkout = {
      contactName: 'Покупець Повернення',
      contactPhone: '+380501234567',
      contactEmail: 'return@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Київ',
      deliveryAddress: 'вул. Тестова 5',
      paymentMethod: 'online' as const,
    };

    const cartItems = [
      {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        price: Number(product.priceRetail),
        quantity: 2,
        isPromo: false,
      },
    ];

    const order = await createOrder(user.id, checkout, cartItems, 'retail');

    // Mark order as completed
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'completed', paymentStatus: 'paid' },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        amount: Number(order.totalAmount),
        paidAt: new Date(),
        paymentProvider: 'liqpay',
      },
    });

    // 2. Customer requests a return
    const returnItems = [
      {
        orderItemId: (await prisma.orderItem.findFirst({ where: { orderId: order.id } }))!.id,
        productName: product.name,
        quantity: 1,
        amount: Number(product.priceRetail),
      },
    ];

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId: user.id,
        status: 'requested',
        reason: 'defective',
        description: 'Товар прийшов з дефектом упаковки',
        items: returnItems,
        totalAmount: Number(product.priceRetail), // returning 1 of 2 items
      },
    });

    expect(returnRequest.id).toBeGreaterThan(0);
    expect(returnRequest.status).toBe('requested');
    expect(returnRequest.reason).toBe('defective');
    expect(Number(returnRequest.totalAmount)).toBeCloseTo(350.0, 2);

    // 3. Admin approves the return
    await prisma.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: 'approved',
        adminComment: 'Повернення схвалено. Очікуємо товар.',
        processedBy: admin.id,
        processedAt: new Date(),
      },
    });

    const approvedReturn = await prisma.returnRequest.findUnique({
      where: { id: returnRequest.id },
    });
    expect(approvedReturn!.status).toBe('approved');
    expect(approvedReturn!.processedBy).toBe(admin.id);
    expect(approvedReturn!.processedAt).not.toBeNull();

    // 4. Goods received back
    await prisma.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: 'received',
        trackingNumber: 'NP-20240001234567',
      },
    });

    // 5. Process refund
    await prisma.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
      },
    });

    // Update payment status to partial refund
    await prisma.payment.update({
      where: { orderId: order.id },
      data: { paymentStatus: 'partial' },
    });

    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'returned' },
    });

    // Restore stock
    await prisma.product.update({
      where: { id: product.id },
      data: { quantity: { increment: 1 } },
    });

    // Create notification
    await prisma.userNotification.create({
      data: {
        userId: user.id,
        notificationType: 'order_status',
        title: 'Повернення оброблено',
        message: `Повернення для замовлення ${order.orderNumber} оброблено. Кошти повернуто.`,
        link: `/account/orders/${order.id}`,
      },
    });

    // === Verify ===

    const finalReturn = await prisma.returnRequest.findUnique({
      where: { id: returnRequest.id },
    });
    expect(finalReturn!.status).toBe('refunded');
    expect(finalReturn!.refundedAt).not.toBeNull();
    expect(finalReturn!.trackingNumber).toBe('NP-20240001234567');

    // Verify payment updated
    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    expect(payment!.paymentStatus).toBe('partial');

    // Verify order status
    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(finalOrder!.status).toBe('returned');

    // Verify stock restored
    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProduct!.quantity).toBe(50 - 2 + 1); // original - ordered + returned

    // Verify notification
    const notifications = await prisma.userNotification.findMany({
      where: { userId: user.id, title: 'Повернення оброблено' },
    });
    expect(notifications).toHaveLength(1);
  });

  it('should reject a return request', async () => {
    const checkout = {
      contactName: 'Покупець',
      contactPhone: '+380501234567',
      contactEmail: 'reject@test.com',
      deliveryMethod: 'nova_poshta' as const,
      paymentMethod: 'cod' as const,
    };

    const cartItems = [
      {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        price: Number(product.priceRetail),
        quantity: 1,
        isPromo: false,
      },
    ];

    const order = await createOrder(user.id, checkout, cartItems, 'retail');

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'completed' },
    });

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        userId: user.id,
        reason: 'changed_mind',
        description: 'Передумав',
        items: [{ productName: product.name, quantity: 1, amount: 350 }],
        totalAmount: 350.0,
      },
    });

    // Admin rejects
    await prisma.returnRequest.update({
      where: { id: returnRequest.id },
      data: {
        status: 'rejected',
        adminComment: 'Термін повернення минув',
        processedBy: admin.id,
        processedAt: new Date(),
      },
    });

    const rejected = await prisma.returnRequest.findUnique({ where: { id: returnRequest.id } });
    expect(rejected!.status).toBe('rejected');
    expect(rejected!.adminComment).toBe('Термін повернення минув');
  });
});
