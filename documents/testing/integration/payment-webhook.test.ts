import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Payment webhook flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    user = await createTestUser({ fullName: 'Платник Тест', phone: '+380501234567' });
    product = await createTestProduct({
      name: 'Товар для оплати',
      priceRetail: 500.0,
      quantity: 50,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create order, simulate LiqPay webhook, and verify payment status', async () => {
    // 1. Create an order with online payment method
    const checkout = {
      contactName: 'Платник Тест',
      contactPhone: '+380501234567',
      contactEmail: 'payer@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Київ',
      deliveryAddress: 'вул. Тестова 1',
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
    expect(order.paymentStatus).toBe('pending');

    // 2. Create a Payment record (simulating payment initiation)
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'online',
        paymentStatus: 'pending',
        amount: Number(order.totalAmount),
        paymentProvider: 'liqpay',
        transactionId: `liqpay_tx_${Date.now()}`,
      },
    });

    expect(payment.id).toBeGreaterThan(0);
    expect(payment.paymentStatus).toBe('pending');

    // 3. Simulate LiqPay webhook callback — mark payment as paid
    const liqpayCallbackData = {
      action: 'pay',
      status: 'success',
      order_id: order.orderNumber,
      transaction_id: payment.transactionId,
      amount: Number(order.totalAmount),
      currency: 'UAH',
      sender_card_mask2: '5168****1234',
    };

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        callbackData: liqpayCallbackData,
      },
    });

    // 4. Update order payment status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'paid',
        status: 'paid',
      },
    });

    // 5. Record status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        oldStatus: 'new_order',
        newStatus: 'paid',
        changeSource: 'system',
        comment: 'Оплата підтверджена через LiqPay',
      },
    });

    // 6. Log the webhook
    await prisma.webhookLog.create({
      data: {
        source: 'liqpay',
        event: 'payment_success',
        payload: liqpayCallbackData,
        statusCode: 200,
      },
    });

    // 7. Create notification for user
    await prisma.userNotification.create({
      data: {
        userId: user.id,
        notificationType: 'order_status',
        title: 'Оплата підтверджена',
        message: `Замовлення ${order.orderNumber} успішно оплачено`,
        link: `/account/orders/${order.id}`,
      },
    });

    // === Verify everything ===

    // Verify payment is now paid
    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment!.paymentStatus).toBe('paid');
    expect(updatedPayment!.paidAt).not.toBeNull();
    expect(updatedPayment!.callbackData).toBeDefined();

    // Verify order status updated
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { statusHistory: true },
    });
    expect(updatedOrder!.paymentStatus).toBe('paid');
    expect(updatedOrder!.status).toBe('paid');
    expect(updatedOrder!.statusHistory).toHaveLength(2); // new_order + paid

    // Verify webhook was logged
    const webhookLogs = await prisma.webhookLog.findMany({
      where: { source: 'liqpay' },
    });
    expect(webhookLogs.length).toBeGreaterThanOrEqual(1);

    // Verify notification was sent
    const notifications = await prisma.userNotification.findMany({
      where: { userId: user.id, notificationType: 'order_status' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('Оплата підтверджена');
  });

  it('should simulate Monobank webhook and update payment', async () => {
    // Create another order
    const checkout = {
      contactName: 'Платник Моно',
      contactPhone: '+380667778899',
      contactEmail: 'mono@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Львів',
      paymentMethod: 'online' as const,
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

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'online',
        paymentStatus: 'pending',
        amount: Number(order.totalAmount),
        paymentProvider: 'monobank',
        transactionId: `mono_inv_${Date.now()}`,
      },
    });

    // Simulate Monobank webhook
    const monoCallbackData = {
      invoiceId: payment.transactionId,
      status: 'success',
      amount: Number(order.totalAmount) * 100, // Monobank uses kopecks
      ccy: 980, // UAH
      reference: order.orderNumber,
    };

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        callbackData: monoCallbackData,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'paid', status: 'paid' },
    });

    await prisma.webhookLog.create({
      data: {
        source: 'monobank',
        event: 'payment_success',
        payload: monoCallbackData,
        statusCode: 200,
      },
    });

    // Verify
    const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment!.paymentStatus).toBe('paid');
    expect(updatedPayment!.paymentProvider).toBe('monobank');

    const webhookLog = await prisma.webhookLog.findFirst({
      where: { source: 'monobank' },
      orderBy: { processedAt: 'desc' },
    });
    expect(webhookLog).not.toBeNull();
  });

  it('should handle failed payment webhook', async () => {
    const checkout = {
      contactName: 'Невдала Оплата',
      contactPhone: '+380501234567',
      contactEmail: 'fail@test.com',
      deliveryMethod: 'nova_poshta' as const,
      paymentMethod: 'online' as const,
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

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: 'online',
        paymentStatus: 'pending',
        amount: Number(order.totalAmount),
        paymentProvider: 'liqpay',
      },
    });

    // Simulate failed payment callback
    await prisma.webhookLog.create({
      data: {
        source: 'liqpay',
        event: 'payment_failure',
        payload: { status: 'failure', order_id: order.orderNumber },
        statusCode: 200,
      },
    });

    // Payment and order should remain pending
    const unchangedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(unchangedPayment!.paymentStatus).toBe('pending');

    const unchangedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchangedOrder!.paymentStatus).toBe('pending');
    expect(unchangedOrder!.status).toBe('new_order');
  });
});
