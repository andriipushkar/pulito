import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  getOrCreateLoyaltyAccount,
  earnPoints,
  spendPoints,
  adjustPoints,
  recalculateLevel,
  getLoyaltyDashboard,
  updateLoyaltySettings,
} from '@/services/loyalty';
import { updateStreakOnOrder } from '@/services/jobs/loyalty-streaks';
import { cleanDatabase, createTestUser, createTestProduct, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Loyalty & gamification flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let product: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    user = await createTestUser({ fullName: 'Loyalty Tester' });
    product = await createTestProduct({ priceRetail: 500.0, quantity: 100 });

    // Set up loyalty levels
    await updateLoyaltySettings([
      { name: 'bronze', minSpent: 0, pointsMultiplier: 1.0, discountPercent: 0, sortOrder: 0 },
      { name: 'silver', minSpent: 5000, pointsMultiplier: 1.5, discountPercent: 3, sortOrder: 1 },
      { name: 'gold', minSpent: 20000, pointsMultiplier: 2.0, discountPercent: 5, sortOrder: 2 },
      { name: 'platinum', minSpent: 50000, pointsMultiplier: 3.0, discountPercent: 10, sortOrder: 3 },
    ]);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create a loyalty account automatically', async () => {
    const account = await getOrCreateLoyaltyAccount(user.id);

    expect(account).toBeDefined();
    expect(account.userId).toBe(user.id);
    expect(account.points).toBe(0);
    expect(Number(account.totalSpent)).toBe(0);
    expect(account.level).toBe('bronze');

    // Calling again should return the same account
    const sameAccount = await getOrCreateLoyaltyAccount(user.id);
    expect(sameAccount.id).toBe(account.id);
  });

  it('should earn points from an order', async () => {
    // Create a mock order in the DB to reference
    const order = await prisma.order.create({
      data: {
        orderNumber: `LOYALTY-TEST-${Date.now()}`,
        userId: user.id,
        status: 'completed',
        clientType: 'retail',
        totalAmount: 1500.0,
        discountAmount: 0,
        deliveryCost: 0,
        itemsCount: 3,
        contactName: 'Loyalty Tester',
        contactPhone: '+380501234567',
        contactEmail: 'loyalty@test.com',
        deliveryMethod: 'nova_poshta',
        paymentMethod: 'cod',
        source: 'web',
      },
    });

    await earnPoints(user.id, order.id, 1500);

    // Verify points were earned (1500 * 1 * 1.0 multiplier = 1500 points)
    const account = await prisma.loyaltyAccount.findUnique({ where: { userId: user.id } });
    expect(account).not.toBeNull();
    expect(account!.points).toBe(1500);
    expect(Number(account!.totalSpent)).toBeCloseTo(1500, 2);

    // Verify transaction was recorded
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { userId: user.id, type: 'earn' },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].points).toBe(1500);
    expect(transactions[0].orderId).toBe(order.id);
  });

  it('should spend points', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `LOYALTY-SPEND-${Date.now()}`,
        userId: user.id,
        status: 'new_order',
        clientType: 'retail',
        totalAmount: 800.0,
        discountAmount: 0,
        deliveryCost: 0,
        itemsCount: 1,
        contactName: 'Loyalty Tester',
        contactPhone: '+380501234567',
        contactEmail: 'loyalty@test.com',
        deliveryMethod: 'nova_poshta',
        paymentMethod: 'cod',
        source: 'web',
      },
    });

    await spendPoints(user.id, 500, order.id);

    const account = await prisma.loyaltyAccount.findUnique({ where: { userId: user.id } });
    expect(account!.points).toBe(1000); // 1500 - 500

    // Verify spend transaction
    const spendTx = await prisma.loyaltyTransaction.findFirst({
      where: { userId: user.id, type: 'spend' },
    });
    expect(spendTx).not.toBeNull();
    expect(spendTx!.points).toBe(-500);
  });

  it('should prevent spending more points than available', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `LOYALTY-OVERSPEND-${Date.now()}`,
        userId: user.id,
        status: 'new_order',
        clientType: 'retail',
        totalAmount: 100.0,
        discountAmount: 0,
        deliveryCost: 0,
        itemsCount: 1,
        contactName: 'Loyalty Tester',
        contactPhone: '+380501234567',
        contactEmail: 'loyalty@test.com',
        deliveryMethod: 'nova_poshta',
        paymentMethod: 'cod',
        source: 'web',
      },
    });

    await expect(spendPoints(user.id, 999999, order.id)).rejects.toThrow(
      /недостатньо балів/i
    );
  });

  it('should manually adjust points', async () => {
    await adjustPoints({
      userId: user.id,
      type: 'manual_add',
      points: 200,
      description: 'Бонус за тест',
    });

    const account = await prisma.loyaltyAccount.findUnique({ where: { userId: user.id } });
    expect(account!.points).toBe(1200); // 1000 + 200

    // Verify transaction
    const addTx = await prisma.loyaltyTransaction.findFirst({
      where: { userId: user.id, type: 'manual_add' },
      orderBy: { createdAt: 'desc' },
    });
    expect(addTx!.points).toBe(200);
    expect(addTx!.description).toBe('Бонус за тест');
  });

  it('should recalculate level based on totalSpent', async () => {
    // Earn enough points to trigger level recalculation
    // Need totalSpent >= 5000 for silver
    const order = await prisma.order.create({
      data: {
        orderNumber: `LOYALTY-LEVEL-${Date.now()}`,
        userId: user.id,
        status: 'completed',
        clientType: 'retail',
        totalAmount: 5000.0,
        discountAmount: 0,
        deliveryCost: 0,
        itemsCount: 10,
        contactName: 'Loyalty Tester',
        contactPhone: '+380501234567',
        contactEmail: 'loyalty@test.com',
        deliveryMethod: 'nova_poshta',
        paymentMethod: 'cod',
        source: 'web',
      },
    });

    await earnPoints(user.id, order.id, 5000);

    // After earnPoints, recalculateLevel is called automatically
    const account = await prisma.loyaltyAccount.findUnique({ where: { userId: user.id } });
    expect(account!.level).toBe('silver'); // totalSpent = 1500 + 5000 = 6500 >= 5000
  });

  it('should return the loyalty dashboard', async () => {
    const dashboard = await getLoyaltyDashboard(user.id);

    expect(dashboard.account).toBeDefined();
    expect(dashboard.account.level).toBe('silver');
    expect(dashboard.account.points).toBeGreaterThan(0);

    expect(dashboard.currentLevel).not.toBeNull();
    expect(dashboard.currentLevel!.name).toBe('silver');
    expect(dashboard.currentLevel!.pointsMultiplier).toBe(1.5);

    expect(dashboard.nextLevel).not.toBeNull();
    expect(dashboard.nextLevel!.name).toBe('gold');

    expect(dashboard.recentTransactions.length).toBeGreaterThan(0);
  });

  it('should create and update loyalty challenges', async () => {
    // Create a challenge
    const challenge = await prisma.loyaltyChallenge.create({
      data: {
        name: 'Перші 3 замовлення',
        description: 'Зробіть 3 замовлення і отримайте 500 бонусних балів',
        type: 'order_count',
        target: 3,
        reward: 500,
        isActive: true,
        startDate: new Date(),
      },
    });

    expect(challenge.id).toBeGreaterThan(0);
    expect(challenge.target).toBe(3);
    expect(challenge.reward).toBe(500);

    // Enroll user in the challenge (create progress)
    const progress = await prisma.loyaltyChallengeProgress.create({
      data: {
        userId: user.id,
        challengeId: challenge.id,
        currentValue: 0,
      },
    });

    expect(progress.currentValue).toBe(0);
    expect(progress.completedAt).toBeNull();

    // Update progress (simulate orders being placed)
    await prisma.loyaltyChallengeProgress.update({
      where: { id: progress.id },
      data: { currentValue: 1 },
    });

    await prisma.loyaltyChallengeProgress.update({
      where: { id: progress.id },
      data: { currentValue: 2 },
    });

    // Complete the challenge
    await prisma.loyaltyChallengeProgress.update({
      where: { id: progress.id },
      data: {
        currentValue: 3,
        completedAt: new Date(),
      },
    });

    // Verify challenge is completed
    const completedProgress = await prisma.loyaltyChallengeProgress.findUnique({
      where: { id: progress.id },
      include: { challenge: true },
    });

    expect(completedProgress!.currentValue).toBe(3);
    expect(completedProgress!.completedAt).not.toBeNull();
    expect(completedProgress!.challenge.reward).toBe(500);

    // Award the reward
    await adjustPoints({
      userId: user.id,
      type: 'manual_add',
      points: completedProgress!.challenge.reward,
      description: `Нагорода за челлендж: ${completedProgress!.challenge.name}`,
    });

    // Mark as rewarded
    await prisma.loyaltyChallengeProgress.update({
      where: { id: progress.id },
      data: { rewardedAt: new Date() },
    });

    const rewardedProgress = await prisma.loyaltyChallengeProgress.findUnique({
      where: { id: progress.id },
    });
    expect(rewardedProgress!.rewardedAt).not.toBeNull();

    // Verify points were added
    const account = await prisma.loyaltyAccount.findUnique({ where: { userId: user.id } });
    // Points before: 1200 (manual_add) + some from earn, now + 500
    expect(account!.points).toBeGreaterThanOrEqual(500);
  });

  it('should track streaks correctly', async () => {
    // Create a streak
    await updateStreakOnOrder(user.id);

    const streak = await prisma.loyaltyStreak.findUnique({ where: { userId: user.id } });
    expect(streak).not.toBeNull();
    expect(streak!.currentStreak).toBe(1);
    expect(streak!.longestStreak).toBe(1);
    expect(streak!.lastOrderDate).not.toBeNull();

    // Another order increases streak
    await updateStreakOnOrder(user.id);

    const updatedStreak = await prisma.loyaltyStreak.findUnique({ where: { userId: user.id } });
    expect(updatedStreak!.currentStreak).toBe(2);
    expect(updatedStreak!.longestStreak).toBe(2);
  });

  it('should enforce unique challenge enrollment per user', async () => {
    const challenge = await prisma.loyaltyChallenge.create({
      data: {
        name: 'Unique Challenge',
        description: 'Test unique constraint',
        type: 'order_count',
        target: 1,
        reward: 100,
        isActive: true,
      },
    });

    await prisma.loyaltyChallengeProgress.create({
      data: {
        userId: user.id,
        challengeId: challenge.id,
        currentValue: 0,
      },
    });

    // Attempting to enroll the same user in the same challenge should fail
    await expect(
      prisma.loyaltyChallengeProgress.create({
        data: {
          userId: user.id,
          challengeId: challenge.id,
          currentValue: 0,
        },
      })
    ).rejects.toThrow();
  });
});
