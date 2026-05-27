import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { isSafeSmtpHost } from '@/utils/safe-url';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { smtpTestSchema } from '@/validators/smtp';
import * as nodemailer from 'nodemailer';

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    // Redis-backed rate-limit so the cap holds across all Node instances —
    // the previous in-memory Map was per-process. Reuse adminPaymentTest
    // (5/min per admin); same risk profile as credential-probe endpoints.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
    if (!rl.allowed) {
      return errorResponse('Забагато тестових надсилань. Зачекайте хвилину.', 429);
    }

    const rawBody = await request.json();
    const parsed = smtpTestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return successResponse({
        success: false,
        error: parsed.error.issues[0]?.message || 'Невалідні дані',
      });
    }
    const { config, testEmail } = parsed.data;

    // SSRF guard: forbid private/loopback/internal hosts. Without this the
    // SMTP-test endpoint becomes an internal port-scanner driven by `err.message`.
    if (!isSafeSmtpHost(config.host)) {
      return successResponse({
        success: false,
        error: 'Заборонено вказувати приватний/локальний SMTP-хост',
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure === true || config.secure === 'true',
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
    // Don't leak raw connection-error strings — they expose internal network
    // topology (hostnames, IPs, TLS internals). Log for the operator, return
    // a generic message to the admin UI.
    if (err instanceof Error) {
      console.error('[smtp-test] failed:', err.message);
    }
    return successResponse({
      success: false,
      error: "Не вдалося з'єднатися з SMTP-сервером",
    });
  }
});
