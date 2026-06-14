import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createNotification } from '@/services/notification';
import { sendPushNotification } from '@/services/push';
import { sendEmail } from '@/services/email';
import { getSuppressedEmails } from '@/services/email-suppression';

const APP_URL = process.env.APP_URL || 'https://pulito.trade';

/**
 * Build predictions by analyzing order history.
 * For each user-product pair with 2+ purchases, calculate average interval.
 * Returns the number of predictions upserted.
 */
export async function buildPredictions(): Promise<number> {
  // Get all completed orders with items, grouped by user-product pair
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        status: 'completed',
        userId: { not: null },
      },
      productId: { not: null },
    },
    select: {
      productId: true,
      order: {
        select: {
          userId: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      order: { createdAt: 'asc' },
    },
  });

  // Group by (userId, productId)
  const grouped = new Map<string, { userId: number; productId: number; dates: Date[] }>();

  for (const item of orderItems) {
    const userId = item.order.userId!;
    const productId = item.productId!;
    const key = `${userId}-${productId}`;

    if (!grouped.has(key)) {
      grouped.set(key, { userId, productId, dates: [] });
    }
    grouped.get(key)!.dates.push(item.order.createdAt);
  }

  // Existing predictions — needed to decide whether to re-arm the reminder.
  // Resetting notificationSent unconditionally on every (daily) rebuild meant
  // the same reminder was re-sent every day while predictedNextDate sat inside
  // the look-ahead window. Re-arm only when the prediction actually moved
  // (a new purchase shifted the cycle).
  const existingPredictions = await prisma.purchasePrediction.findMany({
    select: { userId: true, productId: true, predictedNextDate: true },
  });
  const existingByKey = new Map(
    existingPredictions.map((e) => [`${e.userId}-${e.productId}`, e.predictedNextDate]),
  );

  let upsertedCount = 0;

  for (const [, group] of grouped) {
    // Need at least 2 purchases to calculate an interval
    if (group.dates.length < 2) continue;

    // Sort dates ascending
    const sortedDates = group.dates.sort((a, b) => a.getTime() - b.getTime());

    // Calculate intervals between consecutive purchases (in days)
    const intervals: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const diffMs = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      intervals.push(diffDays);
    }

    const avgIntervalDays = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
    const dataPoints = intervals.length;
    const confidence = Math.min(1, dataPoints / 5);
    const lastPurchaseDate = sortedDates[sortedDates.length - 1];
    const predictedNextDate = new Date(
      lastPurchaseDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000,
    );

    await prisma.purchasePrediction.upsert({
      where: {
        userId_productId: {
          userId: group.userId,
          productId: group.productId,
        },
      },
      update: {
        avgIntervalDays,
        predictedNextDate,
        confidence,
        // Re-arm the reminder only when the predicted date shifted by more
        // than a day — i.e. new purchase data, a genuinely new cycle.
        ...(!existingByKey.has(`${group.userId}-${group.productId}`) ||
        Math.abs(
          predictedNextDate.getTime() -
            existingByKey.get(`${group.userId}-${group.productId}`)!.getTime(),
        ) >
          24 * 60 * 60 * 1000
          ? { notificationSent: false }
          : {}),
      },
      create: {
        userId: group.userId,
        productId: group.productId,
        avgIntervalDays,
        predictedNextDate,
        confidence,
      },
    });

    upsertedCount++;
  }

  logger.info('Purchase predictions built', { upsertedCount });
  return upsertedCount;
}

/**
 * Get upcoming predictions (within N days) that haven't been notified.
 * Send push/email reminders for each.
 * Returns the number of reminders sent.
 */
export async function processReminders(daysAhead = 3): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const predictions = await prisma.purchasePrediction.findMany({
    where: {
      notificationSent: false,
      predictedNextDate: {
        gte: now,
        lte: cutoff,
      },
    },
    include: {
      product: {
        select: { id: true, name: true, slug: true, imagePath: true },
      },
      user: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  // Marketing-grade suppression for the EMAIL channel only — in-app and push
  // are opt-in by nature (account / browser permission) and stay untouched.
  const suppressed = await getSuppressedEmails(
    predictions.map((p) => p.user.email).filter((e): e is string => !!e),
  );

  let sentCount = 0;

  for (const prediction of predictions) {
    try {
      const productName = prediction.product.name;
      const predictedDate = prediction.predictedNextDate.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      // Create in-app notification
      await createNotification({
        userId: prediction.userId,
        type: 'system_notification',
        title: 'Час поповнити запаси!',
        message: `Схоже, у вас закінчується "${productName}". Орієнтовна дата наступної покупки: ${predictedDate}`,
        link: `/product/${prediction.product.slug}`,
      });

      // Send push notification (non-blocking)
      sendPushNotification(prediction.userId, {
        title: 'Час поповнити запаси!',
        body: `Схоже, у вас закінчується "${productName}"`,
        url: `/product/${prediction.product.slug}`,
      }).catch(() => {});

      // Email — the strongest channel for customers who don't visit the
      // cabinet. Suppression-filtered like win-back/cart-recovery; a failed
      // email must not block the in-app/push that already went out.
      if (prediction.user.email && !suppressed.has(prediction.user.email)) {
        const firstName = prediction.user.fullName?.split(' ')[0] ?? null;
        const productUrl = `${APP_URL}/product/${prediction.product.slug}`;
        try {
          await sendEmail({
            to: prediction.user.email,
            subject: `Схоже, у вас закінчується ${productName}`,
            html: `
              <p>${firstName ? `Привіт, ${firstName}` : 'Привіт'}!</p>
              <p>За історією ваших замовлень, приблизно <strong>${predictedDate}</strong> у вас може закінчитися:</p>
              <p style="font-size:16px;margin:16px 0"><strong>${productName}</strong></p>
              <p><a href="${productUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px">Замовити знову</a></p>
              <p style="color:#999;font-size:12px">Якщо не хочете отримувати такі листи — повідомте, ми приберемо вас зі списку.</p>
            `,
          });
        } catch (emailErr) {
          logger.error('Restock reminder email failed', {
            predictionId: prediction.id,
            error: String(emailErr),
          });
        }
      }

      // Mark as sent
      await prisma.purchasePrediction.update({
        where: { id: prediction.id },
        data: { notificationSent: true },
      });

      sentCount++;
    } catch (err) {
      logger.error('Failed to send restock reminder', {
        predictionId: prediction.id,
        error: String(err),
      });
    }
  }

  logger.info('Restock reminders processed', { sentCount });
  return sentCount;
}

/**
 * Get user's upcoming restock predictions.
 */
export async function getUserPredictions(userId: number) {
  return prisma.purchasePrediction.findMany({
    where: {
      userId,
      predictedNextDate: { gte: new Date() },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          imagePath: true,
          priceRetail: true,
          images: {
            select: { pathThumbnail: true },
            where: { isMain: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { predictedNextDate: 'asc' },
  });
}
