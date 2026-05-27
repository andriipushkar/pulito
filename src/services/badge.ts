import { prisma } from '@/lib/prisma';

const NEW_ARRIVAL_DAYS = 14;
const HIT_THRESHOLD = 10; // min orders to be considered a "hit"

/**
 * Auto-assign "new_arrival" badges to products created within the last 14 days
 * and "hit" badges to products with high sales. Runs as a cron job.
 *
 * Locked badges (isLocked=true) are admin-pinned and ignored by both
 * the "qualify" creation step and the cleanup step.
 */
export async function autoAssignBadges(): Promise<{ newArrivals: number; hits: number }> {
  const cutoffDate = new Date(Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000);

  // 1. Auto "new_arrival" badges. Pre-fix loop did N sequential upserts;
  // with 500+ new products a day it added seconds of DB latency.
  // `createMany skipDuplicates` collapses it to one round-trip — the
  // `@@unique([productId, badgeType])` index still keeps it race-safe with
  // concurrent admin inserts.
  const newProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      createdAt: { gte: cutoffDate },
      badges: { none: { badgeType: 'new_arrival' } },
    },
    select: { id: true },
  });
  if (newProducts.length > 0) {
    await prisma.productBadge.createMany({
      data: newProducts.map((p) => ({
        productId: p.id,
        badgeType: 'new_arrival' as const,
        priority: 5,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  // Remove expired "new_arrival" badges — but leave admin-locked ones alone
  await prisma.productBadge.deleteMany({
    where: {
      badgeType: 'new_arrival',
      isLocked: false,
      product: { createdAt: { lt: cutoffDate } },
    },
  });

  // 2. Auto "hit" badges based on ordersCount
  const hitProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      ordersCount: { gte: HIT_THRESHOLD },
      badges: { none: { badgeType: 'hit' } },
    },
    select: { id: true },
  });

  if (hitProducts.length > 0) {
    await prisma.productBadge.createMany({
      data: hitProducts.map((p) => ({
        productId: p.id,
        badgeType: 'hit' as const,
        priority: 4,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  // Remove "hit" badge from products that no longer qualify — except locked ones
  await prisma.productBadge.deleteMany({
    where: {
      badgeType: 'hit',
      isLocked: false,
      product: { ordersCount: { lt: HIT_THRESHOLD } },
    },
  });

  return { newArrivals: newProducts.length, hits: hitProducts.length };
}
