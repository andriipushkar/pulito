import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';

// VAPID keys stay in env (cryptographic material). Only the contact subject
// (vapid_email) is admin-editable, so we configure web-push lazily on first
// send using the DB value, falling back to env then the brand default.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

let vapidConfigured = false;
async function ensureVapidConfigured(): Promise<void> {
  if (vapidConfigured || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  let email = process.env.VAPID_EMAIL || 'mailto:noreply@pulito.trade';
  try {
    const settings = await getSettings();
    if (settings.vapid_email) email = settings.vapid_email;
  } catch {
    // fall back to env/default if settings can't be read
  }
  webpush.setVapidDetails(email, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
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
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
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
  await ensureVapidConfigured();

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
        jsonPayload,
      ),
    ),
  );

  // Cleanup expired/invalid subscriptions
  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === 'rejected' &&
      [404, 410].includes((result.reason as { statusCode?: number })?.statusCode ?? 0)
    ) {
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
  await ensureVapidConfigured();

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
          jsonPayload,
        ),
      ),
    );

    results.forEach((result, j) => {
      if (
        result.status === 'rejected' &&
        [404, 410].includes((result.reason as { statusCode?: number })?.statusCode ?? 0)
      ) {
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

/**
 * Send a push notification to every admin and manager with at least one
 * subscribed device. Used for ops alerts (new marketplace order, new
 * customer message, oversold incident, etc).
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  await ensureVapidConfigured();

  const adminIds = (
    await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager'] }, isBlocked: false },
      select: { id: true },
    })
  ).map((u) => u.id);
  if (adminIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: adminIds } },
  });
  if (subscriptions.length === 0) return;

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/admin',
    icon: payload.icon || '/icons/icon-192x192.png',
  });

  const expiredEndpoints: string[] = [];
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        jsonPayload,
      ),
    ),
  );
  results.forEach((r, i) => {
    if (
      r.status === 'rejected' &&
      [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
    ) {
      expiredEndpoints.push(subscriptions[i].endpoint);
    }
  });
  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expiredEndpoints } } });
  }
}
