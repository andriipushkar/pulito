import { prisma } from '@/lib/prisma';
import { randomBytes, createHmac } from 'crypto';
import { sendEmail } from './email';
import { env } from '@/config/env';

/**
 * Generate a deterministic unsubscribe token from an email address.
 * Uses HMAC-SHA256 so the token cannot be forged without the secret.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = env.APP_URL || 'pulito-unsubscribe';
  return createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
}

export class SubscriberError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SubscriberError';
  }
}

export async function subscribe(email: string, source?: string) {
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing) {
    if (existing.status === 'confirmed') {
      throw new SubscriberError('Ви вже підписані на розсилку', 409);
    }
    if (existing.status === 'pending_sub') {
      // Re-send confirmation
      const token = randomBytes(32).toString('hex');
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: { confirmationToken: token },
      });
      await sendConfirmationEmail(email, token);
      return { message: 'Лист підтвердження надіслано повторно' };
    }
    // Unsubscribed — re-subscribe
    const token = randomBytes(32).toString('hex');
    await prisma.subscriber.update({
      where: { id: existing.id },
      data: { status: 'pending_sub', confirmationToken: token, unsubscribedAt: null },
    });
    await sendConfirmationEmail(email, token);
    return { message: 'Лист підтвердження надіслано' };
  }

  const token = randomBytes(32).toString('hex');
  await prisma.subscriber.create({
    data: { email, confirmationToken: token, source, status: 'pending_sub' },
  });
  await sendConfirmationEmail(email, token);
  return { message: 'Лист підтвердження надіслано на вашу пошту' };
}

export async function confirmSubscription(token: string) {
  const subscriber = await prisma.subscriber.findFirst({
    where: { confirmationToken: token, status: 'pending_sub' },
  });

  if (!subscriber) {
    throw new SubscriberError('Невалідний або прострочений токен підтвердження', 400);
  }

  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: {
      status: 'confirmed',
      confirmationToken: null,
      confirmedAt: new Date(),
    },
  });

  // The signup forms promise «−10% на перше замовлення» — deliver it.
  // Best-effort: a coupon/email hiccup must not fail the confirmation.
  await sendWelcomeCoupon(subscriber.email).catch(() => undefined);

  return { message: 'Підписку підтверджено' };
}

// Shared subscriber-welcome coupon: 10% off, once per user, created on first
// use so no migration/seed is needed. Code is stable so repeat sends are fine.
const WELCOME_COUPON_CODE = 'WELCOME10';

async function sendWelcomeCoupon(email: string): Promise<void> {
  let coupon = await prisma.coupon.findUnique({ where: { code: WELCOME_COUPON_CODE } });
  if (!coupon) {
    coupon = await prisma.coupon
      .create({
        data: {
          code: WELCOME_COUPON_CODE,
          description: 'Знижка за підписку на розсилку',
          type: 'percent',
          value: 10,
          usageLimitPerUser: 1,
          isActive: true,
        },
      })
      // Parallel confirmations can race on the unique code — fall back to read.
      .catch(() => prisma.coupon.findUnique({ where: { code: WELCOME_COUPON_CODE } }));
  }
  if (!coupon || !coupon.isActive) return;

  const appUrl = env.APP_URL || '';
  await sendEmail({
    to: email,
    subject: '🎁 Ваш промокод на −10% всередині',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Дякуємо за підписку!</h2>
        <p>Як і обіцяли — ваш промокод на <strong>знижку 10%</strong> на перше замовлення:</p>
        <p style="text-align:center;margin:24px 0"><span style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:8px;padding:12px 32px;font-size:24px;font-weight:bold;letter-spacing:2px;color:#2563eb">${WELCOME_COUPON_CODE}</span></p>
        <p>Введіть його в полі «Промокод» при оформленні замовлення.</p>
        <a href="${appUrl}/catalog?utm_source=email&utm_campaign=welcome_coupon" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">До каталогу</a>
      </div>
    `,
  });
}

export async function unsubscribe(token: string) {
  // Token is an HMAC-SHA256 hash derived from the subscriber's email.
  // Check all confirmed/pending subscribers to find a match.
  const subscribers = await prisma.subscriber.findMany({
    where: { status: { in: ['confirmed', 'pending_sub'] } },
  });

  const subscriber = subscribers.find((s) => generateUnsubscribeToken(s.email) === token);

  if (!subscriber) {
    throw new SubscriberError('Підписку не знайдено', 404);
  }

  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { status: 'unsubscribed', unsubscribedAt: new Date() },
  });

  return { message: 'Ви відписались від розсилки' };
}

export async function unsubscribeByEmail(email: string) {
  const subscriber = await prisma.subscriber.findUnique({ where: { email } });
  if (!subscriber || subscriber.status === 'unsubscribed') {
    throw new SubscriberError('Підписку не знайдено', 404);
  }

  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { status: 'unsubscribed', unsubscribedAt: new Date() },
  });

  return { message: 'Ви відписались від розсилки' };
}

async function sendConfirmationEmail(email: string, token: string) {
  const url = `${env.APP_URL}/subscribe/confirm?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Підтвердіть підписку — Pulito Trade',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Підтвердження підписки</h2>
        <p>Дякуємо за підписку на розсилку Pulito Trade!</p>
        <p>Для підтвердження підписки натисніть на кнопку нижче:</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Підтвердити підписку</a>
        <p style="color:#64748b;font-size:14px">Або скопіюйте це посилання: <br/>${url}</p>
        <p style="color:#64748b;font-size:14px">Якщо ви не підписувались, проігноруйте цей лист.</p>
      </div>
    `,
  });
}
