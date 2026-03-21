import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [60, 300, 900, 3600, 7200]; // 1m, 5m, 15m, 1h, 2h

function getNextRetryAt(retryCount: number): Date {
  const delaySec = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
  return new Date(Date.now() + delaySec * 1000);
}

/**
 * Process pending notifications with retry support.
 * Failed notifications are retried with exponential backoff.
 * After MAX_RETRIES failures, notifications are marked as dead letters.
 */
export async function processNotificationQueue(): Promise<{ sent: number; failed: number; deadLetters: number }> {
  const now = new Date();

  const notifications = await prisma.userNotification.findMany({
    where: {
      dispatched: false,
      retryCount: { lt: MAX_RETRIES },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
      createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // last 48h
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          telegramChatId: true,
          viberUserId: true,
          notificationPrefs: true,
        },
      },
    },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  let failed = 0;
  let deadLetters = 0;

  for (const notification of notifications) {
    const prefs = (notification.user.notificationPrefs as Record<string, boolean>) || {};
    const type = notification.notificationType;
    let channelSent = false;
    let lastError: string | undefined;

    // Map notification type to preference keys
    const emailPrefKey = type === 'order_status' ? 'email_orders' : type === 'promo' ? 'email_promo' : 'email_orders';
    const tgPrefKey = type === 'order_status' ? 'telegram_orders' : type === 'promo' ? 'telegram_promo' : 'telegram_orders';
    const viberPrefKey = type === 'order_status' ? 'viber_orders' : type === 'promo' ? 'viber_promo' : 'viber_orders';

    // Email notification
    const shouldEmail = prefs[emailPrefKey] !== false;
    if (shouldEmail && notification.user.email) {
      try {
        await sendEmail({
          to: notification.user.email,
          subject: notification.title,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#2563eb">${notification.title}</h2>
              <p>${notification.message}</p>
              ${notification.link ? `<a href="${process.env.APP_URL || ''}${notification.link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Переглянути</a>` : ''}
            </div>
          `,
        });
        channelSent = true;
      } catch (err) {
        lastError = `email: ${err instanceof Error ? err.message : 'unknown'}`;
      }
    }

    // Telegram notification
    const shouldTelegram = prefs[tgPrefKey] !== false;
    if (shouldTelegram && notification.user.telegramChatId) {
      try {
        if (type !== 'order_status') {
          const { sendClientNotification } = await import('./telegram');
          await sendClientNotification(
            Number(notification.user.telegramChatId),
            notification.title,
            notification.message,
            notification.link
          );
        }
        channelSent = true;
      } catch (err) {
        lastError = `telegram: ${err instanceof Error ? err.message : 'unknown'}`;
      }
    }

    // Viber notification
    const shouldViber = prefs[viberPrefKey] !== false;
    if (shouldViber && notification.user.viberUserId) {
      try {
        if (type !== 'order_status') {
          const { sendViberNotification } = await import('./viber');
          await sendViberNotification(
            notification.user.id,
            notification.title,
            notification.message,
            notification.link
          );
        }
        channelSent = true;
      } catch (err) {
        lastError = `viber: ${err instanceof Error ? err.message : 'unknown'}`;
      }
    }

    // Push notification
    try {
      const { sendPushNotification } = await import('./push');
      await sendPushNotification(notification.user.id, {
        title: notification.title,
        body: notification.message,
        url: notification.link ?? undefined,
      });
      channelSent = true;
    } catch {
      // Push not configured or no subscriptions — skip silently
    }

    if (channelSent) {
      await prisma.userNotification.update({
        where: { id: notification.id },
        data: { dispatched: true },
      });
      sent++;
    } else {
      const newRetryCount = notification.retryCount + 1;

      if (newRetryCount >= MAX_RETRIES) {
        // Dead letter — mark as dispatched to stop retries, log error
        await prisma.userNotification.update({
          where: { id: notification.id },
          data: {
            retryCount: newRetryCount,
            lastError: lastError ?? 'max retries exceeded',
            dispatched: true,
          },
        });
        deadLetters++;
      } else {
        await prisma.userNotification.update({
          where: { id: notification.id },
          data: {
            retryCount: newRetryCount,
            nextRetryAt: getNextRetryAt(newRetryCount),
            lastError,
          },
        });
        failed++;
      }
    }
  }

  return { sent, failed, deadLetters };
}
