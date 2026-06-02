import { prisma } from '@/lib/prisma';

/**
 * Returns the subset of `emails` that have OPTED OUT of marketing mail —
 * Subscriber.status === 'unsubscribed' or unsubscribedAt is set.
 *
 * Marketing crons (win-back, cart-recovery, welcome series, digests, etc.)
 * must filter their recipient list through this before calling sendEmail().
 * Transactional mail (order confirmation, password reset, verification,
 * subscription-cycle reminders) must NOT use it — those are not marketing.
 *
 * This centralises the inline check that campaign.ts already performs so
 * every marketing sender honours the same global opt-out list.
 */
export async function getSuppressedEmails(
  emails: (string | null | undefined)[],
): Promise<Set<string>> {
  const clean = emails.filter((e): e is string => !!e);
  if (clean.length === 0) return new Set();

  const rows = await prisma.subscriber.findMany({
    where: {
      email: { in: clean },
      OR: [{ status: 'unsubscribed' }, { unsubscribedAt: { not: null } }],
    },
    select: { email: true },
  });
  return new Set(rows.map((r) => r.email));
}
