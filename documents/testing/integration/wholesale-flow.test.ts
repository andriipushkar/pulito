import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Wholesale flow (real DB)', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    admin = await createTestUser({ fullName: 'Адмін', role: 'admin' });
    product = await createTestProduct({
      name: 'Оптовий товар',
      priceRetail: 100.0,
      priceWholesale: 75.0,
      priceWholesale2: 65.0,
      priceWholesale3: 55.0,
      quantity: 1000,
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should register user, request wholesale, admin approves, verify prices', async () => {
    // 1. Register a new user (client role by default)
    const wholesaleUser = await createTestUser({
      fullName: 'Оптовий Покупець',
      phone: '+380501234567',
      companyName: 'ТОВ "Чисто"',
      edrpou: '12345678',
      ownershipType: 'tov',
    });

    expect(wholesaleUser.role).toBe('client');
    expect(wholesaleUser.wholesaleStatus).toBe('none');

    // 2. User requests wholesale status
    await prisma.user.update({
      where: { id: wholesaleUser.id },
      data: {
        wholesaleStatus: 'pending',
        wholesaleRequestDate: new Date(),
        wholesaleMonthlyVol: '50000-100000',
      },
    });

    const pendingUser = await prisma.user.findUnique({ where: { id: wholesaleUser.id } });
    expect(pendingUser!.wholesaleStatus).toBe('pending');
    expect(pendingUser!.wholesaleRequestDate).not.toBeNull();

    // 3. Admin approves wholesale status
    await prisma.user.update({
      where: { id: wholesaleUser.id },
      data: {
        wholesaleStatus: 'approved',
        wholesaleApprovedDate: new Date(),
        wholesaleGroup: 1,
        role: 'wholesaler',
        assignedManagerId: admin.id,
      },
    });

    // Log the audit
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        actionType: 'wholesale_approve',
        entityType: 'user',
        entityId: wholesaleUser.id,
        details: { companyName: 'ТОВ "Чисто"', edrpou: '12345678' },
      },
    });

    // 4. Verify user is now a wholesaler
    const approvedUser = await prisma.user.findUnique({ where: { id: wholesaleUser.id } });
    expect(approvedUser!.role).toBe('wholesaler');
    expect(approvedUser!.wholesaleStatus).toBe('approved');
    expect(approvedUser!.wholesaleApprovedDate).not.toBeNull();
    expect(approvedUser!.wholesaleGroup).toBe(1);
    expect(approvedUser!.assignedManagerId).toBe(admin.id);

    // 5. Verify wholesale prices are accessible
    const dbProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(dbProduct).not.toBeNull();
    expect(Number(dbProduct!.priceRetail)).toBeCloseTo(100.0, 2);
    expect(Number(dbProduct!.priceWholesale!)).toBeCloseTo(75.0, 2);
    expect(Number(dbProduct!.priceWholesale2!)).toBeCloseTo(65.0, 2);
    expect(Number(dbProduct!.priceWholesale3!)).toBeCloseTo(55.0, 2);

    // Wholesale user with group 1 should see priceWholesale
    const effectivePrice =
      approvedUser!.wholesaleGroup === 1
        ? Number(dbProduct!.priceWholesale)
        : Number(dbProduct!.priceRetail);
    expect(effectivePrice).toBeCloseTo(75.0, 2);

    // 6. Verify audit log was recorded
    const auditEntry = await prisma.auditLog.findFirst({
      where: { actionType: 'wholesale_approve', entityId: wholesaleUser.id },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry!.userId).toBe(admin.id);
  });

  it('should reject a wholesale request', async () => {
    const user = await createTestUser({
      fullName: 'Відмовлений Оптовик',
      companyName: 'ФОП Тест',
    });

    // Request wholesale
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wholesaleStatus: 'pending',
        wholesaleRequestDate: new Date(),
      },
    });

    // Admin rejects
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wholesaleStatus: 'rejected',
        adminNote: 'Невідповідний обсяг замовлень',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        actionType: 'wholesale_reject',
        entityType: 'user',
        entityId: user.id,
        details: { reason: 'Невідповідний обсяг замовлень' },
      },
    });

    const rejectedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(rejectedUser!.wholesaleStatus).toBe('rejected');
    expect(rejectedUser!.role).toBe('client'); // Should remain client
    expect(rejectedUser!.adminNote).toBe('Невідповідний обсяг замовлень');
  });

  it('should set wholesale rules for products', async () => {
    const rule = await prisma.wholesaleRule.create({
      data: {
        ruleType: 'min_quantity',
        productId: product.id,
        value: 10,
        isActive: true,
      },
    });

    expect(rule.id).toBeGreaterThan(0);
    expect(rule.ruleType).toBe('min_quantity');
    expect(Number(rule.value)).toBe(10);

    // Verify rule is associated with the product
    const rules = await prisma.wholesaleRule.findMany({
      where: { productId: product.id, isActive: true },
    });
    expect(rules.length).toBeGreaterThanOrEqual(1);
  });
});
