import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';
import { logger } from '@/lib/logger';

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
        subject: 'Ласкаво просимо до Порошок! 🎉',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h1 style="color:#2563eb">Вітаємо, ${user.fullName}!</h1>
            <p>Дякуємо за реєстрацію в інтернет-магазині <strong>Порошок</strong>.</p>
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
        await sendEmail({
          to: user.email,
          subject,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#2563eb">${user.fullName}, ми сумуємо!</h2>
              <p>Ви давно не відвідували наш магазин. Повертайтесь і отримайте знижку <strong>${discount}</strong> на наступне замовлення!</p>
              <a href="${appUrl}/catalog?utm_source=email&utm_campaign=winback_${days}d" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Перейти до каталогу</a>
            </div>
          `,
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
 * Post-purchase: send review request 7 days after delivered order.
 */
export async function processPostPurchaseReviewRequest(): Promise<{ sent: number }> {
  const appUrl = process.env.APP_URL || '';
  const targetDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: 'completed',
      updatedAt: { gte: targetDate, lt: windowEnd },
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
