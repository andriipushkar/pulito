import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';
import { logger } from '@/lib/logger';
import { generateUnsubscribeToken } from './subscriber';

/**
 * Email automation sequences for customer lifecycle.
 */

/**
 * Welcome series: send welcome email to users registered in the last 24h
 * who haven't received the welcome email yet.
 */
export async function processWelcomeSeries(): Promise<{ sent: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const newUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: since },
      isVerified: true,
      isBlocked: false,
    },
    select: { id: true, email: true, fullName: true, referralCode: true },
    take: 50,
  });

  let sent = 0;
  const appUrl = process.env.APP_URL || '';

  for (const user of newUsers) {
    // Check if welcome email already sent
    const alreadySent = await prisma.userNotification.findFirst({
      where: { userId: user.id, notificationType: 'welcome' },
    });
    if (alreadySent) continue;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Ласкаво просимо до Pulito Trade! 🎉',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h1 style="color:#2563eb">Вітаємо, ${user.fullName}!</h1>
            <p>Дякуємо за реєстрацію в інтернет-магазині <strong>Pulito Trade</strong>.</p>
            <p>Ось що вас чекає:</p>
            <ul>
              <li>🛒 Широкий асортимент побутової хімії</li>
              <li>💰 Бонусна програма за кожну покупку</li>
              <li>📦 Швидка доставка по Україні</li>
              <li>🎁 Акційні пропозиції та знижки</li>
            </ul>
            ${user.referralCode ? `<p>Ваш реферальний код: <strong>${user.referralCode}</strong> — поділіться з друзями та отримайте бонуси!</p>` : ''}
            <a href="${appUrl}/catalog" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Перейти до каталогу</a>
          </div>
        `,
      });

      await prisma.userNotification.create({
        data: {
          userId: user.id,
          notificationType: 'welcome',
          title: 'Ласкаво просимо!',
          message: 'Дякуємо за реєстрацію',
          dispatched: true,
        },
      });

      sent++;
    } catch (err) {
      logger.error(`[welcome-series] Failed for user ${user.id}`, { error: String(err) });
    }
  }

  return { sent };
}

/**
 * Win-back sequence: email inactive users who haven't ordered in 30/60/90 days.
 */
export async function processWinBack(): Promise<{ sent: number }> {
  const appUrl = process.env.APP_URL || '';
  let sent = 0;

  const intervals = [
    { days: 30, subject: 'Ми сумуємо за вами! 🛒', discount: '5%' },
    { days: 60, subject: 'Повертайтесь — маємо щось особливе для вас 🎁', discount: '10%' },
    { days: 90, subject: 'Останній шанс — спеціальна знижка тільки для вас 🔥', discount: '15%' },
  ];

  for (const { days, subject, discount } of intervals) {
    const targetDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const windowStart = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);

    // Users whose last order was exactly N days ago (within 24h window)
    const users = await prisma.user.findMany({
      where: {
        isBlocked: false,
        orders: {
          some: {},
          none: { createdAt: { gte: targetDate } },
        },
      },
      select: { id: true, email: true, fullName: true },
      take: 20,
    });

    for (const user of users) {
      const alreadySent = await prisma.userNotification.findFirst({
        where: {
          userId: user.id,
          notificationType: 'winback',
          createdAt: { gte: windowStart },
        },
      });
      if (alreadySent) continue;

      try {
        const unsubToken = generateUnsubscribeToken(user.email);
        const unsubUrl = `${appUrl}/unsubscribe?token=${unsubToken}`;
        await sendEmail({
          to: user.email,
          subject,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#2563eb">${user.fullName}, ми сумуємо!</h2>
              <p>Ви давно не відвідували наш магазин. Повертайтесь і отримайте знижку <strong>${discount}</strong> на наступне замовлення!</p>
              <a href="${appUrl}/catalog?utm_source=email&utm_campaign=winback_${days}d" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Перейти до каталогу</a>
              <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb"><a href="${unsubUrl}" style="color:#6b7280;font-size:12px">Відписатися від розсилки</a></div>
            </div>
          `,
          listUnsubscribe: unsubUrl,
        });

        await prisma.userNotification.create({
          data: {
            userId: user.id,
            notificationType: 'winback',
            title: subject,
            message: `Win-back ${days}d`,
            dispatched: true,
          },
        });

        sent++;
      } catch (err) {
        logger.error(`[winback] Failed for user ${user.id}`, { error: String(err) });
      }
    }
  }

  return { sent };
}

/**
 * Post-purchase: send review request 7 days after the order transitioned
 * to `completed`. Uses OrderStatusHistory to read the actual completion
 * timestamp — Order.updatedAt drifts when admins edit the row afterwards.
 */
export async function processPostPurchaseReviewRequest(): Promise<{ sent: number }> {
  const appUrl = process.env.APP_URL || '';
  const targetDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

  const completions = await prisma.orderStatusHistory.findMany({
    where: {
      newStatus: 'completed',
      createdAt: { gte: targetDate, lt: windowEnd },
    },
    select: { orderId: true },
    take: 200,
  });

  const orderIds = [...new Set(completions.map((c) => c.orderId))];
  if (orderIds.length === 0) return { sent: 0 };

  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      status: 'completed',
      userId: { not: null },
    },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      items: { select: { productName: true }, take: 3 },
    },
    take: 30,
  });

  let sent = 0;

  for (const order of orders) {
    if (!order.user?.email) continue;

    const alreadySent = await prisma.userNotification.findFirst({
      where: {
        userId: order.user.id,
        notificationType: 'review_request',
        createdAt: { gte: targetDate },
      },
    });
    if (alreadySent) continue;

    const productNames = order.items.map((i) => i.productName).join(', ');

    try {
      await sendEmail({
        to: order.user.email,
        subject: 'Як вам товари? Залиште відгук ⭐',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#2563eb">${order.user.fullName}, як ваше замовлення?</h2>
            <p>Ви нещодавно отримали: <strong>${productNames}</strong></p>
            <p>Будь ласка, залиште відгук — це допоможе іншим покупцям зробити правильний вибір!</p>
            <a href="${appUrl}/account/orders/${order.id}?review=true" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Залишити відгук</a>
            <p style="color:#64748b;font-size:12px">За відгук з фото ви отримаєте бонусні бали!</p>
          </div>
        `,
      });

      await prisma.userNotification.create({
        data: {
          userId: order.user.id,
          notificationType: 'review_request',
          title: 'Залиште відгук',
          message: `Замовлення #${order.orderNumber}`,
          dispatched: true,
        },
      });

      sent++;
    } catch (err) {
      logger.error(`[post-purchase] Failed for order ${order.id}`, { error: String(err) });
    }
  }

  return { sent };
}

// Ukrainian display names for the default loyalty tiers; unknown custom tier
// names fall through as-is.
const TIER_LABELS: Record<string, string> = {
  bronze: 'Бронзовий',
  silver: 'Срібний',
  gold: 'Золотий',
  platinum: 'Платиновий',
};

/**
 * Warn customers ~14 days before loyalty points expire, using the same
 * mixed-sign net math as the expiry job (jobs/expire-loyalty-points.ts) but
 * with the cutoff shifted WARN_AHEAD_DAYS into the future. Dedup: at most one
 * warning per 30 days per user (NotificationType has no dedicated value and
 * the enum can't be extended without a prod migration — so we match
 * system_notification + title).
 */
export async function processLoyaltyExpiryWarnings(): Promise<{ sent: number }> {
  const appUrl = process.env.APP_URL || '';
  const WARN_AHEAD_DAYS = 14;
  const WARN_TITLE = 'Бали скоро згорять';

  const levels = await prisma.loyaltyLevel.findMany({
    where: { pointsExpiryMonths: { not: null } },
    select: { name: true, pointsExpiryMonths: true },
  });
  if (levels.length === 0) return { sent: 0 };
  const levelMap = new Map(levels.map((l) => [l.name, l.pointsExpiryMonths!]));

  const accounts = await prisma.loyaltyAccount.findMany({
    where: { level: { in: Array.from(levelMap.keys()) }, points: { gt: 0 } },
    select: {
      userId: true,
      points: true,
      level: true,
      user: { select: { email: true, fullName: true } },
    },
    take: 500,
  });

  const expiresAtLabel = new Date(
    Date.now() + WARN_AHEAD_DAYS * 24 * 60 * 60 * 1000,
  ).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

  let sent = 0;
  for (const acc of accounts) {
    if (!acc.user?.email) continue;
    const months = levelMap.get(acc.level);
    if (!months) continue;

    // Transactions old enough that they'll cross the expiry cutoff within the
    // warning window.
    const warnCutoff = new Date();
    warnCutoff.setMonth(warnCutoff.getMonth() - months);
    warnCutoff.setDate(warnCutoff.getDate() + WARN_AHEAD_DAYS);

    const oldTxns = await prisma.loyaltyTransaction.findMany({
      where: { userId: acc.userId, createdAt: { lt: warnCutoff } },
      select: { type: true, points: true },
    });
    let net = 0;
    for (const t of oldTxns) {
      if (t.type === 'earn' || t.type === 'manual_add') net += Math.abs(t.points);
      else net -= Math.abs(t.points);
    }
    const expiring = Math.min(Math.max(net, 0), acc.points);
    if (expiring === 0) continue;

    const recentWarning = await prisma.userNotification.findFirst({
      where: {
        userId: acc.userId,
        notificationType: 'system_notification',
        title: WARN_TITLE,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentWarning) continue;

    try {
      await sendEmail({
        to: acc.user.email,
        subject: `⏳ ${expiring} бонусних балів згорять ${expiresAtLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#2563eb">${acc.user.fullName}, не втратьте свої бали!</h2>
            <p>На вашому рахунку <strong>${acc.points}</strong> бонусних балів, з них <strong>${expiring}</strong> згорять приблизно <strong>${expiresAtLabel}</strong>.</p>
            <p>Встигніть використати їх зі знижкою на наступне замовлення.</p>
            <a href="${appUrl}/catalog?utm_source=email&utm_campaign=loyalty_expiry" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Перейти до каталогу</a>
          </div>
        `,
      });

      await prisma.userNotification.create({
        data: {
          userId: acc.userId,
          notificationType: 'system_notification',
          title: WARN_TITLE,
          message: `${expiring} балів згорять ${expiresAtLabel}`,
          link: '/account/loyalty',
          dispatched: true,
        },
      });
      sent++;
    } catch (err) {
      logger.error(`[loyalty-expiry-warn] Failed for user ${acc.userId}`, { error: String(err) });
    }
  }

  return { sent };
}

/**
 * Congratulate a customer on reaching a higher loyalty tier. Called
 * fire-and-forget from loyalty.ts AFTER the tier-change transaction commits —
 * never inside it (an SMTP hiccup must not roll back the points credit).
 */
export async function notifyLoyaltyTierUp(
  userId: number,
  // discountPercent arrives as a Prisma Decimal from loyalty.ts — typed
  // loosely and normalised via Number() below.
  newLevel: { name: string; discountPercent?: unknown; pointsMultiplier?: number },
): Promise<void> {
  const appUrl = process.env.APP_URL || '';
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true },
  });
  if (!user?.email) return;

  const tierLabel = TIER_LABELS[newLevel.name] || newLevel.name;
  const discount = Number(newLevel.discountPercent || 0);
  const multiplier = Number(newLevel.pointsMultiplier || 1);
  const perks = [
    discount > 0 ? `знижка ${discount}% на всі замовлення` : null,
    multiplier > 1 ? `бали ×${multiplier} за кожну покупку` : null,
  ].filter(Boolean);

  try {
    await sendEmail({
      to: user.email,
      subject: `🎉 Вітаємо — ви досягли рівня «${tierLabel}»!`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#2563eb">${user.fullName}, ваш новий рівень — «${tierLabel}»!</h2>
          <p>Дякуємо, що обираєте нас. Ваші покупки підняли вас на новий рівень програми лояльності.</p>
          ${perks.length ? `<p>Тепер вам доступно: <strong>${perks.join(', ')}</strong>.</p>` : ''}
          <a href="${appUrl}/account/loyalty?utm_source=email&utm_campaign=tier_up" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Мої бонуси</a>
        </div>
      `,
    });

    await prisma.userNotification.create({
      data: {
        userId,
        notificationType: 'system_notification',
        title: 'Новий рівень лояльності',
        message: `Вітаємо з рівнем «${tierLabel}»!`,
        link: '/account/loyalty',
        dispatched: true,
      },
    });
  } catch (err) {
    logger.error(`[tier-up] Failed for user ${userId}`, { error: String(err) });
  }
}
