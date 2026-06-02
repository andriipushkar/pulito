import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';
import { getSuppressedEmails } from '@/services/email-suppression';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';

/**
 * Dormant-customer re-engagement.
 *
 * Pick users who:
 *   - Have at least one completed/paid/shipped order
 *   - Whose latest order is in a target dormancy window (default 60-180 days ago)
 *   - Have not received a win-back email in the last 90 days
 *
 * For each, issue a unique 10% coupon and email them. Logged into `WinBackEvent`
 * for dedup and metrics.
 */

const APP_URL = process.env.APP_URL || 'https://pulito.trade';
const DEFAULT_MIN_DAYS_DORMANT = 60;
const DEFAULT_MAX_DAYS_DORMANT = 180;
const DEFAULT_DISCOUNT = 10;
const COUPON_VALIDITY_HOURS = 14 * 24; // 14 days
const REPEAT_GUARD_DAYS = 90;

function generateWinBackCode(): string {
  return `COMEBACK-${randomBytes(4).toString('hex').toUpperCase()}`;
}

async function issueCoupon(discountPercent: number) {
  const validUntil = new Date(Date.now() + COUPON_VALIDITY_HOURS * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateWinBackCode();
    try {
      return await prisma.coupon.create({
        data: {
          code,
          description: `Win-back ${discountPercent}%`,
          type: 'percent',
          value: discountPercent,
          usageLimit: 1,
          usageLimitPerUser: 1,
          validFrom: new Date(),
          validUntil,
          isActive: true,
        },
        select: { id: true, code: true },
      });
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error('Failed to generate unique win-back coupon');
}

interface RunOptions {
  minDaysDormant?: number;
  maxDaysDormant?: number;
  discountPercent?: number;
  maxToSend?: number;
}

export async function runWinBackCampaign(options: RunOptions = {}) {
  const minDays = options.minDaysDormant ?? DEFAULT_MIN_DAYS_DORMANT;
  const maxDays = options.maxDaysDormant ?? DEFAULT_MAX_DAYS_DORMANT;
  const discount = options.discountPercent ?? DEFAULT_DISCOUNT;
  const cap = options.maxToSend ?? 200;

  const now = Date.now();
  const dormantSince = new Date(now - maxDays * 24 * 60 * 60 * 1000);
  const dormantUntil = new Date(now - minDays * 24 * 60 * 60 * 1000);
  const repeatGuard = new Date(now - REPEAT_GUARD_DAYS * 24 * 60 * 60 * 1000);

  // Latest order per user via groupBy
  const latestOrders = await prisma.order.groupBy({
    by: ['userId'],
    where: {
      userId: { not: null },
      status: { in: ['completed', 'paid', 'shipped'] },
      deletedAt: null,
    },
    _max: { createdAt: true },
  });

  const candidateIds: number[] = [];
  for (const row of latestOrders) {
    if (row.userId === null || !row._max.createdAt) continue;
    if (row._max.createdAt >= dormantUntil) continue;
    if (row._max.createdAt < dormantSince) continue;
    candidateIds.push(row.userId);
  }

  if (candidateIds.length === 0) {
    return { processed: 0, skipped: 0, failed: 0 };
  }

  // Filter out users who got a win-back email in the past REPEAT_GUARD_DAYS
  const recentSent = await prisma.winBackEvent.findMany({
    where: { userId: { in: candidateIds }, sentAt: { gte: repeatGuard } },
    select: { userId: true },
  });
  const recentSentIds = new Set(recentSent.map((e) => e.userId));

  const users = await prisma.user.findMany({
    where: {
      id: { in: candidateIds.filter((id) => !recentSentIds.has(id)) },
      isBlocked: false,
    },
    select: { id: true, email: true, fullName: true },
    take: cap,
  });

  // Honour the global marketing opt-out list — never mail unsubscribed users.
  const suppressed = await getSuppressedEmails(users.map((u) => u.email));

  let processed = 0;
  let failed = 0;
  let skipped = recentSentIds.size;

  for (const u of users) {
    if (!u.email) continue;
    if (suppressed.has(u.email)) {
      skipped += 1;
      continue;
    }
    const userLatest = latestOrders.find((r) => r.userId === u.id);
    const daysSince = userLatest?._max.createdAt
      ? Math.floor((now - userLatest._max.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    let couponId: number | null = null;
    let promoCode = '';
    try {
      const coupon = await issueCoupon(discount);
      couponId = coupon.id;
      promoCode = coupon.code;
    } catch (err) {
      logger.error('[win-back] coupon issue failed', { userId: u.id, error: String(err) });
      failed += 1;
      continue;
    }

    const firstName = u.fullName?.split(' ')[0] ?? null;
    try {
      await sendEmail({
        to: u.email,
        subject: 'Скучили за вами — знижка 10%',
        html: `
          <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
          <p>Давно вас не бачили в Pulito Trade. Ваш персональний промокод на повернення:</p>
          <p style="font-size:20px;margin:16px 0">Код: <strong>${promoCode}</strong></p>
          <p>Знижка <strong>${discount}%</strong> на будь-яке наступне замовлення. Діє 14 днів.</p>
          <p><a href="${APP_URL}/catalog?promo=${promoCode}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px">Обрати товари</a></p>
          <p style="color:#999;font-size:12px">Якщо не хочете отримувати такі листи — повідомте, ми приберемо вас зі списку.</p>
        `,
      });

      await prisma.winBackEvent.create({
        data: {
          userId: u.id,
          daysSinceLastOrder: daysSince,
          couponId,
        },
      });

      processed += 1;
      logger.info('[win-back] sent', { userId: u.id, daysSince, couponId });
    } catch (err) {
      failed += 1;
      logger.warn('[win-back] email failed', { userId: u.id, error: String(err) });
      if (couponId) {
        await prisma.coupon
          .update({ where: { id: couponId }, data: { isActive: false } })
          .catch(() => {});
      }
    }
  }

  return { processed, skipped, failed };
}
