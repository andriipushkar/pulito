import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import * as nodemailer from 'nodemailer';

// In-memory rate limit: 5 test sends per admin per minute. Prevents an
// admin from accidentally turning the "Test" button into a spam cannon
// (or testing it 200 times to verify config).
const RATE_BUCKET = new Map<number, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function isRateLimited(adminId: number): boolean {
  const now = Date.now();
  const hits = (RATE_BUCKET.get(adminId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  RATE_BUCKET.set(adminId, hits);
  return hits.length > RATE_MAX;
}

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    if (isRateLimited(user.id)) {
      return errorResponse('Забагато тестових надсилань. Зачекайте хвилину.', 429);
    }
    const { config, testEmail } = await request.json();

    if (!config.host || !config.port) {
      return successResponse({ success: false, error: "Host та Port обов'язкові" });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port),
      secure: config.secure === 'true' || config.secure === true,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10000,
    });

    // Verify connection
    await transporter.verify();

    // Send test email if address provided
    if (testEmail) {
      await transporter.sendMail({
        from: config.fromName
          ? `"${config.fromName}" <${config.from || config.user}>`
          : config.from || config.user,
        to: testEmail,
        subject: 'Тестовий лист від Pulito Trade',
        text: 'Це тестовий лист. Якщо ви його бачите — SMTP налаштовано правильно!',
        html: '<h2>Тестовий лист</h2><p>Якщо ви бачите цей лист — SMTP налаштовано правильно!</p>',
      });
      return successResponse({ success: true, name: `SMTP OK, лист надіслано на ${testEmail}` });
    }

    return successResponse({
      success: true,
      name: `SMTP з'єднання успішне (${config.host}:${config.port})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Помилка з'єднання";
    return successResponse({ success: false, error: message });
  }
});
