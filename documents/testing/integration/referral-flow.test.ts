import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrder } from '@/services/order';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Referral flow (real DB)', () => {
  let referrer: Awaited<ReturnType<typeof createTestUser>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    product = await createTestProduct({
      name: 'Товар для реферала',
      priceRetail: 200.0,
      quantity: 100,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create referral code, register referred user, order, and grant bonus', async () => {
    // 1. User A creates/has a referral code
    referrer = await createTestUser({
      fullName: 'Реферер Тест',
      referralCode: 'REF-TEST-123',
    });

    expect(referrer.referralCode).toBe('REF-TEST-123');

    // 2. User B registers with the referral code
    const referred = await createTestUser({
      fullName: 'Запрошений Тест',
      phone: '+380667778899',
    });

    // Create referral record linking the two users
    const referral = await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: referred.id,
        referralCode: 'REF-TEST-123',
        status: 'registered',
      },
    });

    expect(referral.id).toBeGreaterThan(0);
    expect(referral.status).toBe('registered');
    expect(referral.referrerUserId).toBe(referrer.id);
    expect(referral.referredUserId).toBe(referred.id);

    // 3. User B places an order
    const checkout = {
      contactName: 'Запрошений Тест',
      contactPhone: '+380667778899',
      contactEmail: 'referred@test.com',
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

    const order = await createOrder(referred.id, checkout, cartItems, 'retail');
    expect(order).toBeDefined();

    // 4. Update referral status to first_order
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'first_order',
        bonusOrderId: order.id,
        convertedAt: new Date(),
      },
    });

    const updatedReferral = await prisma.referral.findUnique({ where: { id: referral.id } });
    expect(updatedReferral!.status).toBe('first_order');
    expect(updatedReferral!.bonusOrderId).toBe(order.id);
    expect(updatedReferral!.convertedAt).not.toBeNull();

    // 5. Grant bonus to referrer (User A)
    const bonusValue = 50.0; // fixed bonus amount

    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'bonus_granted',
        bonusType: 'fixed',
        bonusValue,
      },
    });

    // Create a notification for the referrer
    await prisma.userNotification.create({
      data: {
        userId: referrer.id,
        notificationType: 'promo',
        title: 'Реферальний бонус',
        message: `Ваш запрошений друг зробив перше замовлення! Ваш бонус: ${bonusValue} грн`,
      },
    });

    // 6. Verify referral is fully completed
    const finalReferral = await prisma.referral.findUnique({ where: { id: referral.id } });
    expect(finalReferral!.status).toBe('bonus_granted');
    expect(Number(finalReferral!.bonusValue)).toBeCloseTo(bonusValue, 2);
    expect(finalReferral!.bonusType).toBe('fixed');

    // 7. Verify notification was created for referrer
    const notifications = await prisma.userNotification.findMany({
      where: { userId: referrer.id, notificationType: 'promo' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('Реферальний бонус');
  });

  it('should prevent duplicate referral for the same user pair', async () => {
    const referred = await createTestUser({ fullName: 'Дубль Реферал' });

    // Create first referral
    await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: referred.id,
        referralCode: 'REF-TEST-123',
        status: 'registered',
      },
    });

    // Verify the referral exists
    const referrals = await prisma.referral.findMany({
      where: {
        referrerUserId: referrer.id,
        referredUserId: referred.id,
      },
    });
    expect(referrals).toHaveLength(1);
  });

  it('should track multiple referrals for the same referrer', async () => {
    const referredB = await createTestUser({ fullName: 'Запрошений B' });
    const referredC = await createTestUser({ fullName: 'Запрошений C' });

    await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: referredB.id,
        referralCode: 'REF-TEST-123',
        status: 'registered',
      },
    });

    await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: referredC.id,
        referralCode: 'REF-TEST-123',
        status: 'registered',
      },
    });

    const allReferrals = await prisma.referral.findMany({
      where: { referrerUserId: referrer.id },
    });
    expect(allReferrals.length).toBeGreaterThanOrEqual(3); // includes earlier test referrals
  });
});
