import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createNotification } from '@/services/notification';
import { sendPushNotification } from '@/services/push';

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
    const predictedNextDate = new Date(lastPurchaseDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000);

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
        notificationSent: false,
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
        select: { id: true, fullName: true },
      },
    },
  });

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
