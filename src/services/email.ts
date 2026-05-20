import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { env } from '@/config/env';
import { getSmtpConfig } from '@/services/smtp-config';

// Transporter is recreated whenever the SMTP config changes (host/port/auth).
// We memoize one instance per config signature so we don't pay nodemailer setup
// cost on every send, but we still pick up admin-UI changes after cache flush.
let cachedTransporter: { signature: string; transporter: ReturnType<typeof nodemailer.createTransport> } | null = null;

async function getTransporter() {
  const cfg = await getSmtpConfig();
  const signature = `${cfg.host}|${cfg.port}|${cfg.secure}|${cfg.user}|${cfg.pass}`;
  if (cachedTransporter?.signature === signature) return cachedTransporter.transporter;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  cachedTransporter = { signature, transporter };
  return transporter;
}

export class EmailError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public originalError?: unknown,
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
  listUnsubscribe?: string;
  from?: string;
  replyTo?: string;
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
  /** Tracking ID injected into the open-pixel URL (if HTML contained {{notificationId}}) */
  trackingId?: string;
}

function generateTrackingId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
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
  let trackingId: string | undefined;
  let html = options.html;

  // Substitute {{notificationId}} → fresh tracking UUID so the open-pixel can be matched.
  if (html.includes('{{notificationId}}')) {
    trackingId = generateTrackingId();
    html = html.replace(/\{\{notificationId\}\}/g, trackingId);
  }

  try {
    const cfg = await getSmtpConfig();
    const transporter = await getTransporter();
    // SMTP_FROM may be either a bare address ("a@b.com") or a fully-formatted
    // RFC 5322 string ('"Name" <a@b.com>'). Wrap only if it's still bare,
    // otherwise we'd nest the display name and produce an invalid header.
    const isFormatted = (v: string) => v.includes('<') && v.includes('>');
    const fromSource = cfg.from || cfg.user;
    const defaultFrom = isFormatted(fromSource) ? fromSource : `"${cfg.fromName}" <${fromSource}>`;
    const result = await withRetry(async () => {
      attempts++;
      return transporter.sendMail({
        from: options.from || defaultFrom,
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
        to: options.to,
        subject: options.subject,
        html,
        text: options.text || htmlToPlainText(html),
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
        ...(options.listUnsubscribe && {
          headers: {
            'List-Unsubscribe': `<${options.listUnsubscribe}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });
    });

    return { success: true, messageId: result.messageId, attempts, trackingId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Невідома помилка відправки email';
    throw new EmailError(message, 500, error);
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${env.APP_URL}/auth/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Підтвердіть ваш email — Pulito Trade',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Підтвердження email</h2>
        <p>Дякуємо за реєстрацію в Pulito Trade!</p>
        <p>Для підтвердження вашої електронної пошти натисніть на кнопку нижче:</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Підтвердити email</a>
        <p style="color:#64748b;font-size:14px">Або скопіюйте це посилання: <br/>${url}</p>
        <p style="color:#64748b;font-size:14px">Посилання дійсне протягом 24 годин.</p>
      </div>
    `,
  });
}

// HTML escape for user-controlled fields injected into email markup.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface OrderConfirmationEmail {
  to: string;
  contactName: string;
  orderNumber: string;
  totalAmount: number | string;
  itemsCount: number;
  deliveryMethod?: string | null;
  paymentMethod?: string | null;
}

/**
 * Customer-facing "your order is in" email. Sent fire-and-forget after
 * createOrder. Guests in particular need this — without it they have no
 * record of orderNumber once they close the tab.
 */
export async function sendOrderConfirmationEmail(opts: OrderConfirmationEmail): Promise<void> {
  const trackUrl = `${env.APP_URL}/order/${encodeURIComponent(opts.orderNumber)}/track`;
  const total = Number(opts.totalAmount).toFixed(2);
  await sendEmail({
    to: opts.to,
    subject: `Замовлення #${opts.orderNumber} прийнято — Pulito Trade`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
        <h2 style="color:#2563eb;margin-bottom:8px">Дякуємо за замовлення!</h2>
        <p style="margin-top:0">Вітаємо, ${escapeHtml(opts.contactName) || 'клієнте'}!</p>
        <p>Ми отримали ваше замовлення <strong>#${escapeHtml(opts.orderNumber)}</strong>. Менеджер зв'яжеться з вами найближчим часом для підтвердження.</p>
        <table style="margin:16px 0;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Сума:</td><td style="padding:4px 0"><strong>${total} ₴</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Товарів:</td><td style="padding:4px 0">${opts.itemsCount}</td></tr>
          ${opts.deliveryMethod ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Доставка:</td><td style="padding:4px 0">${escapeHtml(opts.deliveryMethod)}</td></tr>` : ''}
          ${opts.paymentMethod ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Оплата:</td><td style="padding:4px 0">${escapeHtml(opts.paymentMethod)}</td></tr>` : ''}
        </table>
        <a href="${trackUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Відстежити замовлення</a>
        <p style="color:#64748b;font-size:14px;margin-top:24px">Якщо у вас виникли питання — відповідайте на цей лист, ми на зв'язку.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${env.APP_URL}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Відновлення пароля — Pulito Trade',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Відновлення пароля</h2>
        <p>Ви запросили відновлення пароля для вашого акаунту Pulito Trade.</p>
        <p>Для створення нового пароля натисніть на кнопку нижче:</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Відновити пароль</a>
        <p style="color:#64748b;font-size:14px">Або скопіюйте це посилання: <br/>${url}</p>
        <p style="color:#64748b;font-size:14px">Посилання дійсне протягом 1 години.</p>
        <p style="color:#64748b;font-size:14px">Якщо ви не запитували відновлення пароля, проігноруйте цей лист.</p>
      </div>
    `,
  });
}
