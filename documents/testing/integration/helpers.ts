import { prisma } from '@/lib/prisma';
import { setupTestDB } from './setup';

/**
 * Push the Prisma schema to the test DB (full reset).
 * Call once in a globalSetup or in the first beforeAll.
 */
export async function resetDatabase() {
  await setupTestDB();
}

/**
 * Delete all rows from every table in the correct order (respecting FK constraints).
 * Faster than a full schema push between individual test files.
 */
export async function cleanDatabase() {
  // Delete in reverse-dependency order
  await prisma.$transaction([
    prisma.loyaltyChallengeProgress.deleteMany(),
    prisma.loyaltyChallenge.deleteMany(),
    prisma.loyaltyStreak.deleteMany(),
    prisma.loyaltyTransaction.deleteMany(),
    prisma.loyaltyAccount.deleteMany(),
    prisma.loyaltyLevel.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.order.deleteMany(),
    prisma.subscriptionItem.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.blogPost.deleteMany(),
    prisma.blogCategory.deleteMany(),
    prisma.marketplaceListing.deleteMany(),
    prisma.marketplaceConnection.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
    prisma.siteSetting.deleteMany(),
  ]);
}

/**
 * Create a test user and return it.
 */
export async function createTestUser(overrides: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      fullName: 'Test User',
      role: 'client',
      isVerified: true,
      passwordHash: '$2a$10$fakehashforintegrationtests000000000000000000',
      ...overrides,
    },
  });
}

/**
 * Create a test product with stock.
 */
export async function createTestProduct(overrides: Record<string, unknown> = {}) {
  const code = `TEST-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prisma.product.create({
    data: {
      code,
      name: `Test Product ${code}`,
      slug: `test-product-${code.toLowerCase()}`,
      priceRetail: 100.0,
      quantity: 50,
      isActive: true,
      ...overrides,
    },
  });
}

/**
 * Disconnect the Prisma client. Call in globalTeardown or final afterAll.
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
