import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:noreply@poroshok.ua';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Subscribe a user to push notifications.
 */
export async function subscribePush(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

/**
 * Unsubscribe a push endpoint.
 */
export async function unsubscribePush(endpoint: string) {
  await prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
}

/**
 * Send push notification to all subscriptions of a user.
 */
export async function sendPushNotification(userId: number, payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return;

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/icons/icon-192x192.png',
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        jsonPayload
      )
    )
  );

  // Cleanup expired/invalid subscriptions
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected' && (result.reason as { statusCode?: number })?.statusCode === 410) {
      expiredEndpoints.push(subscriptions[i].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
  }
}

/**
 * Send push notification to all subscribed users (e.g., for promo).
 */
export async function sendPushToAll(payload: PushPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return;

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/icons/icon-192x192.png',
  });

  const expiredEndpoints: string[] = [];

  // Send in batches of 50 to avoid overload
  const batchSize = 50;
  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          jsonPayload
        )
      )
    );

    results.forEach((result, j) => {
      if (result.status === 'rejected' && (result.reason as { statusCode?: number })?.statusCode === 410) {
        expiredEndpoints.push(batch[j].endpoint);
      }
    });
  }

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expiredEndpoints } },
    });
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
