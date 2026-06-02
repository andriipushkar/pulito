import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';
import { getSuppressedEmails } from '@/services/email-suppression';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';

/**
 * Abandoned-cart recovery.
 *
 *   Level 1: cart updated 1–2 hours ago        → "ви забули кошик"
 *   Level 2: cart updated 24–25 hours ago      → "знижка 5%"
 *   Level 3: cart updated 72–73 hours ago      → "останній шанс — знижка 10%"
 *
 * Each (user, level) pair is sent at most once — guarded by a `CartRecoveryEvent`
 * row written on success. Promo codes are issued as real `Coupon` rows so the
 * checkout flow can actually redeem them; the coupon is single-use, single-user,
 * and expires in 48h.
 */

interface ReminderWindow {
  level: 1 | 2 | 3;
  minHours: number;
  maxHours: number;
  /** Percent discount (0 = no coupon for this level). */
  discountPercent: number;
  subject: (firstName: string | null) => string;
  body: (params: {
    firstName: string | null;
    items: { name: string; quantity: number }[];
    promoCode: string | null;
  }) => string;
}

const APP_URL = process.env.APP_URL || 'https://pulito.trade';
const COUPON_VALIDITY_HOURS = 48;

const WINDOWS: ReminderWindow[] = [
  {
    level: 1,
    minHours: 1,
    maxHours: 2,
    discountPercent: 0,
    subject: (n) => (n ? `${n}, ваш кошик чекає` : 'Ваш кошик чекає'),
    body: ({ firstName, items }) => `
      <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
      <p>Ви залишили товари у кошику в Pulito Trade. Завершіть замовлення поки вони ще в наявності:</p>
      <ul>${items.map((i) => `<li>${i.name} — ${i.quantity} шт</li>`).join('')}</ul>
      <p><a href="${APP_URL}/cart" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px">Перейти до кошика</a></p>
    `,
  },
  {
    level: 2,
    minHours: 24,
    maxHours: 25,
    discountPercent: 5,
    subject: (n) => (n ? `${n}, знижка 5% на ваше замовлення` : 'Знижка 5% на ваше замовлення'),
    body: ({ firstName, items, promoCode }) => `
      <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
      <p>Ваш кошик усе ще нас чекає. Як подарунок — <strong>знижка 5%</strong> на ваше замовлення:</p>
      <ul>${items.map((i) => `<li>${i.name} — ${i.quantity} шт</li>`).join('')}</ul>
      <p style="font-size:18px">Код: <strong>${promoCode}</strong></p>
      <p><a href="${APP_URL}/cart?promo=${promoCode}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px">Застосувати та оформити</a></p>
      <p style="color:#666;font-size:12px">Промокод дійсний 48 годин і може бути використаний один раз.</p>
    `,
  },
  {
    level: 3,
    minHours: 72,
    maxHours: 73,
    discountPercent: 10,
    subject: () => 'Останній шанс — знижка 10%',
    body: ({ firstName, items, promoCode }) => `
      <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
      <p>Останній шанс забрати товари за спеціальною ціною. <strong>Знижка 10%</strong>:</p>
      <ul>${items.map((i) => `<li>${i.name} — ${i.quantity} шт</li>`).join('')}</ul>
      <p style="font-size:18px">Код: <strong>${promoCode}</strong></p>
      <p><a href="${APP_URL}/cart?promo=${promoCode}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px">Забрати знижку</a></p>
      <p style="color:#666;font-size:12px">Пропозиція діє 48 годин. Промокод одноразовий.</p>
    `,
  },
];

function generatePromoCode(level: number): string {
  // 8 hex chars from crypto-strong RNG → 16M codes per level
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `RECOVER${level}-${suffix}`;
}

async function issueRecoveryCoupon(
  level: number,
  discountPercent: number,
): Promise<{
  id: number;
  code: string;
}> {
  const validUntil = new Date(Date.now() + COUPON_VALIDITY_HOURS * 60 * 60 * 1000);
  // Retry on the rare collision of the random suffix
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePromoCode(level);
    try {
      const coupon = await prisma.coupon.create({
        data: {
          code,
          description: `Cart recovery reminder level ${level}`,
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
      return coupon;
    } catch (err) {
      // Unique violation on `code` → retry
      if (attempt === 4) throw err;
    }
  }
  throw new Error('Failed to generate unique recovery coupon code');
}

export async function runAbandonedCartRecovery() {
  const now = new Date();
  const results: { level: number; sent: number; skipped: number; failed: number }[] = [];

  for (const win of WINDOWS) {
    const since = new Date(now.getTime() - win.maxHours * 60 * 60 * 1000);
    const until = new Date(now.getTime() - win.minHours * 60 * 60 * 1000);

    const items = await prisma.cartItem.findMany({
      where: {
        updatedAt: { gte: since, lt: until },
      },
      select: {
        userId: true,
        quantity: true,
        product: { select: { id: true, name: true } },
        user: { select: { email: true, fullName: true } },
      },
    });

    const byUser = new Map<
      number,
      {
        email: string | null;
        fullName: string | null;
        items: { productId: number; name: string; quantity: number }[];
      }
    >();
    for (const it of items) {
      if (!it.user?.email) continue;
      const bucket = byUser.get(it.userId) ?? {
        email: it.user.email,
        fullName: it.user.fullName,
        items: [],
      };
      bucket.items.push({
        productId: it.product.id,
        name: it.product.name,
        quantity: it.quantity,
      });
      byUser.set(it.userId, bucket);
    }

    // Deduplicate: skip users who already received this level reminder
    const candidateUserIds = Array.from(byUser.keys());
    const alreadySent = await prisma.cartRecoveryEvent.findMany({
      where: {
        userId: { in: candidateUserIds },
        reminderLevel: win.level,
      },
      select: { userId: true },
    });
    const alreadySentIds = new Set(alreadySent.map((e) => e.userId));

    // Honour the global marketing opt-out list — never mail unsubscribed users.
    const suppressed = await getSuppressedEmails(Array.from(byUser.values()).map((i) => i.email));

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const [userId, info] of byUser) {
      if (alreadySentIds.has(userId)) {
        skipped += 1;
        continue;
      }
      if (!info.email) continue;
      if (suppressed.has(info.email)) {
        skipped += 1;
        continue;
      }
      const firstName = info.fullName?.split(' ')[0] ?? null;

      let couponId: number | null = null;
      let promoCode: string | null = null;

      if (win.discountPercent > 0) {
        try {
          const coupon = await issueRecoveryCoupon(win.level, win.discountPercent);
          couponId = coupon.id;
          promoCode = coupon.code;
        } catch (err) {
          logger.error('Failed to issue recovery coupon', {
            userId,
            level: win.level,
            error: String(err),
          });
          failed += 1;
          continue;
        }
      }

      try {
        await sendEmail({
          to: info.email,
          subject: win.subject(firstName),
          html: win.body({ firstName, items: info.items, promoCode }),
        });

        await prisma.cartRecoveryEvent.create({
          data: {
            userId,
            reminderLevel: win.level,
            cartSnapshot: info.items,
            couponId,
          },
        });

        sent += 1;
        logger.info('Abandoned cart reminder sent', {
          userId,
          level: win.level,
          couponId,
        });
      } catch (err) {
        failed += 1;
        logger.error('Failed to send abandoned cart reminder', {
          userId,
          level: win.level,
          error: String(err),
        });
        // Disable the issued coupon so it can't be redeemed
        if (couponId) {
          await prisma.coupon
            .update({ where: { id: couponId }, data: { isActive: false } })
            .catch(() => {});
        }
      }
    }
    results.push({ level: win.level, sent, skipped, failed });
  }

  return results;
}
