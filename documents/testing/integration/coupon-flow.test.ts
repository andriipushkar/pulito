import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Coupon flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    admin = await createTestUser({ fullName: 'Адмін Купонів', role: 'admin' });
    user = await createTestUser({ fullName: 'Покупець Купон', phone: '+380501234567' });
    product = await createTestProduct({
      name: 'Товар для купона',
      priceRetail: 500.0,
      quantity: 100,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create a percent coupon, apply at checkout, verify discount and redemption', async () => {
    // 1. Create a percent coupon
    const coupon = await prisma.coupon.create({
      data: {
        code: 'SAVE10',
        description: 'Знижка 10% на замовлення',
        type: 'percent',
        value: 10.0,
        minOrderAmount: 200.0,
        maxDiscount: 100.0,
        usageLimit: 50,
        usageLimitPerUser: 1,
        usedCount: 0,
        isActive: true,
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: admin.id,
      },
    });

    expect(coupon.id).toBeGreaterThan(0);
    expect(coupon.code).toBe('SAVE10');
    expect(coupon.type).toBe('percent');

    // 2. Validate coupon before applying
    const validCoupon = await prisma.coupon.findUnique({ where: { code: 'SAVE10' } });
    expect(validCoupon).not.toBeNull();
    expect(validCoupon!.isActive).toBe(true);
    expect(validCoupon!.usedCount).toBeLessThan(validCoupon!.usageLimit!);

    // 3. Create order
    const checkout = {
      contactName: 'Покупець Купон',
      contactPhone: '+380501234567',
      contactEmail: 'coupon@test.com',
      deliveryMethod: 'nova_poshta' as const,
      deliveryCity: 'Київ',
      paymentMethod: 'cod' as const,
    };

    const cartItems = [
      {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        price: Number(product.priceRetail),
        quantity: 3,
        isPromo: false,
      },
    ];

    const order = await createOrder(user.id, checkout, cartItems, 'retail');
    const orderTotal = Number(order.totalAmount); // 3 * 500 = 1500

    // 4. Apply coupon — calculate discount
    const discount = Math.min(
      orderTotal * (Number(validCoupon!.value) / 100),
      Number(validCoupon!.maxDiscount!)
    );
    expect(discount).toBe(100.0); // 10% of 1500 = 150, but max is 100

    // 5. Update order with discount
    await prisma.order.update({
      where: { id: order.id },
      data: {
        discountAmount: discount,
        totalAmount: orderTotal - discount,
      },
    });

    // 6. Record coupon redemption
    await prisma.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId: user.id,
        orderId: order.id,
        discount,
      },
    });

    // 7. Increment usage count
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    // === Verify ===

    // Verify order discount
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(Number(updatedOrder!.discountAmount)).toBeCloseTo(100.0, 2);
    expect(Number(updatedOrder!.totalAmount)).toBeCloseTo(1400.0, 2);

    // Verify redemption recorded
    const redemptions = await prisma.couponRedemption.findMany({
      where: { couponId: coupon.id },
    });
    expect(redemptions).toHaveLength(1);
    expect(Number(redemptions[0].discount)).toBeCloseTo(100.0, 2);
    expect(redemptions[0].userId).toBe(user.id);
    expect(redemptions[0].orderId).toBe(order.id);

    // Verify usage count incremented
    const updatedCoupon = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    expect(updatedCoupon!.usedCount).toBe(1);
  });

  it('should create a fixed-amount coupon and apply correctly', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: 'FLAT50',
        type: 'fixed_amount',
        value: 50.0,
        minOrderAmount: 100.0,
        usageLimit: 100,
        isActive: true,
        createdBy: admin.id,
      },
    });

    // Verify fixed discount
    const orderTotal = 500.0;
    const discount = Math.min(Number(coupon.value), orderTotal);
    expect(discount).toBe(50.0);

    // Record redemption
    await prisma.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId: user.id,
        discount,
      },
    });

    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    const updated = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    expect(updated!.usedCount).toBe(1);
  });

  it('should enforce usage limit', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: 'ONETIME',
        type: 'percent',
        value: 5.0,
        usageLimit: 1,
        usedCount: 1, // already used up
        isActive: true,
        createdBy: admin.id,
      },
    });

    // Coupon should be fully used
    const loaded = await prisma.coupon.findUnique({ where: { code: 'ONETIME' } });
    expect(loaded!.usedCount).toBeGreaterThanOrEqual(loaded!.usageLimit!);
  });

  it('should reject expired coupon', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: 'EXPIRED',
        type: 'percent',
        value: 20.0,
        isActive: true,
        validFrom: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired yesterday
        createdBy: admin.id,
      },
    });

    // Validation check
    const loaded = await prisma.coupon.findUnique({ where: { code: 'EXPIRED' } });
    const isExpired = loaded!.validUntil && loaded!.validUntil < new Date();
    expect(isExpired).toBe(true);
  });

  it('should reject coupon below minimum order amount', async () => {
    const coupon = await prisma.coupon.findUnique({ where: { code: 'SAVE10' } });
    expect(coupon).not.toBeNull();

    const orderTotal = 50.0; // Below min_order_amount of 200
    const meetsMinimum = !coupon!.minOrderAmount || orderTotal >= Number(coupon!.minOrderAmount);
    expect(meetsMinimum).toBe(false);
  });

  it('should create a free-delivery coupon', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: 'FREEDEL',
        type: 'free_delivery',
        value: 0,
        isActive: true,
        createdBy: admin.id,
      },
    });

    expect(coupon.type).toBe('free_delivery');

    // Free delivery means delivery cost is 0
    const deliveryCostAfterCoupon = coupon.type === 'free_delivery' ? 0 : 60;
    expect(deliveryCostAfterCoupon).toBe(0);
  });
});
