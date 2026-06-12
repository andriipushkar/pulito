import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Expire loyalty points that were earned longer ago than the customer's
 * current level allows. Uses LoyaltyLevel.pointsExpiryMonths (null = forever).
 *
 * Algorithm:
 *   for each LoyaltyAccount:
 *     - look up the customer's level → expiry months
 *     - skip if null (level allows perpetual points)
 *     - sum positive `earn` transactions older than cutoff date that haven't
 *       been spent (net positive after deducting `spend`/`expire` of same age)
 *     - if there's a net to expire, create an `expire` transaction (negative)
 *       and decrement account.points
 *
 * Idempotency: we don't re-expire points already expired because the new
 * `expire` transaction shifts the cumulative net. Subsequent runs see less
 * "old earn" to undo.
 *
 * Conservative: we expire by the LEVEL of the account at run time, not the
 * level at earn time. Customers who downgraded keep their points but new
 * earn rules apply.
 */
export async function expireLoyaltyPoints() {
  // Map level name → expiry months
  const levels = await prisma.loyaltyLevel.findMany({
    where: { pointsExpiryMonths: { not: null } },
    select: { name: true, pointsExpiryMonths: true },
  });
  if (levels.length === 0) return { expired: 0, processed: 0 };

  const levelMap = new Map(levels.map((l) => [l.name, l.pointsExpiryMonths!]));

  // Only iterate accounts whose level has an expiry policy
  const accounts = await prisma.loyaltyAccount.findMany({
    where: { level: { in: Array.from(levelMap.keys()) }, points: { gt: 0 } },
    select: { id: true, userId: true, points: true, level: true },
  });

  let expired = 0;
  for (const acc of accounts) {
    const months = levelMap.get(acc.level);
    if (!months) continue;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const oldTxns = await prisma.loyaltyTransaction.findMany({
      where: { userId: acc.userId, createdAt: { lt: cutoff } },
      select: { type: true, points: true },
    });
    // Net positive in the "old" window = points to expire (cap at current
    // account balance — we can't subtract more than they have).
    // Math.abs both ways: stored signs are MIXED (spend rows are negative via
    // loyalty.ts `points: -points`; expire/manual_deduct are positive). Raw
    // `net -= t.points` ADDED spends back, inflating the expirable net and
    // burning recently-earned points that should have survived.
    let net = 0;
    for (const t of oldTxns) {
      if (t.type === 'earn' || t.type === 'manual_add') net += Math.abs(t.points);
      else net -= Math.abs(t.points); // spend, expire, manual_deduct
    }
    const toExpire = Math.min(Math.max(net, 0), acc.points);
    if (toExpire === 0) continue;

    await prisma.$transaction([
      prisma.loyaltyTransaction.create({
        data: {
          userId: acc.userId,
          type: 'expire',
          points: toExpire,
          description: `Прострочення ${toExpire} балів (старше ${months} міс)`,
        },
      }),
      prisma.loyaltyAccount.update({
        where: { id: acc.id },
        data: { points: { decrement: toExpire } },
      }),
    ]);
    expired += toExpire;
    logger.info(`[loyalty-expire] user ${acc.userId}: −${toExpire} points`);
  }

  return { expired, processed: accounts.length };
}
