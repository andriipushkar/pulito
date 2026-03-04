import nodemailer from 'nodemailer';
import { env } from '@/config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: Number(env.SMTP_PORT) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export class EmailError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/₴/g, '\u20B4')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  let attempts = 0;
  try {
    const result = await withRetry(async () => {
      attempts++;
      return transporter.sendMail({
        from: env.SMTP_FROM || `"Порошок" <${env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || htmlToPlainText(options.html),
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    });

    return { success: true, messageId: result.messageId, attempts };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Невідома помилка відправки email';
    throw new EmailError(message, 500, error);
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${env.APP_URL}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Підтвердіть ваш email — Порошок',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Підтвердження email</h2>
        <p>Дякуємо за реєстрацію в Порошок!</p>
        <p>Для підтвердження вашої електронної пошти натисніть на кнопку нижче:</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Підтвердити email</a>
        <p style="color:#64748b;font-size:14px">Або скопіюйте це посилання: <br/>${url}</p>
        <p style="color:#64748b;font-size:14px">Посилання дійсне протягом 24 годин.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${env.APP_URL}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Відновлення пароля — Порошок',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Відновлення пароля</h2>
        <p>Ви запросили відновлення пароля для вашого акаунту Порошок.</p>
        <p>Для створення нового пароля натисніть на кнопку нижче:</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Відновити пароль</a>
        <p style="color:#64748b;font-size:14px">Або скопіюйте це посилання: <br/>${url}</p>
        <p style="color:#64748b;font-size:14px">Посилання дійсне протягом 1 години.</p>
        <p style="color:#64748b;font-size:14px">Якщо ви не запитували відновлення пароля, проігноруйте цей лист.</p>
      </div>
    `,
  });
}
