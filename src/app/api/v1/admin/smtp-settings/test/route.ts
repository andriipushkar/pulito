import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse } from '@/utils/api-response';
import * as nodemailer from 'nodemailer';

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const { config, testEmail } = await request.json();

    if (!config.host || !config.port) {
      return successResponse({ success: false, error: 'Host та Port обов\'язкові' });
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
        subject: 'Тестовий лист від Порошок',
        text: 'Це тестовий лист. Якщо ви його бачите — SMTP налаштовано правильно!',
        html: '<h2>Тестовий лист</h2><p>Якщо ви бачите цей лист — SMTP налаштовано правильно!</p>',
      });
      return successResponse({ success: true, name: `SMTP OK, лист надіслано на ${testEmail}` });
    }

    return successResponse({ success: true, name: `SMTP з'єднання успішне (${config.host}:${config.port})` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Помилка з\'єднання';
    return successResponse({ success: false, error: message });
  }
});
