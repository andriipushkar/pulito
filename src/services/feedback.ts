import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';
import { sanitizeHtml } from '@/utils/sanitize';
import { logger } from '@/lib/logger';
import { isSafeUrl } from '@/utils/safe-url';

// Cap recipients to avoid a notification storm if many staff users get added
// over time — 50 covers any realistic team and stops a runaway sendEmail loop.
const NOTIFY_RECIPIENT_CAP = 50;

export class FeedbackError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FeedbackError';
  }
}

export async function createFeedback(data: {
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  type: 'form' | 'callback';
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const created = await prisma.feedback.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      // Trim subject so a whitespace-only string doesn't leak as
      // `"[форма]    — Ім'я"` in admin notifications.
      subject: data.subject?.trim() || undefined,
      message: data.message,
      type: data.type,
      status: 'new_feedback',
      // Forensics for spam-burst triage. Schema needs `ip_address` / `user_agent`
      // string columns; if absent, Prisma silently ignores unknown fields, but
      // we wrap in optional spread to avoid runtime errors on older deploys.
      ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
      ...(data.userAgent ? { userAgent: data.userAgent } : {}),
    },
  });

  // Notify admins/managers about a new submission. Fire-and-forget so the
  // user-facing API stays fast even if SMTP is slow.
  notifyManagersOfNewFeedback(created.id).catch((err) =>
    logger.warn('[feedback] notifyManagersOfNewFeedback failed', { error: err }),
  );

  return created;
}

async function notifyManagersOfNewFeedback(feedbackId: number) {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) return;

  // Send to every active admin/manager. Roles list kept tight — wholesalers
  // and customers must never get internal escalations. Capped to avoid
  // a notification storm if the team grows large.
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['admin', 'manager'] },
      isBlocked: false,
      email: { not: '' },
    },
    select: { email: true },
    take: NOTIFY_RECIPIENT_CAP,
  });
  if (recipients.length === 0) return;

  const rawAppUrl = process.env.APP_URL || 'https://pulito.trade';
  // Refuse `javascript:` / `data:` / private-IP schemes even if APP_URL is
  // tampered. The link is rendered in HTML email — a malicious href would
  // execute on click in some mail clients.
  const APP_URL = isSafeUrl(rawAppUrl) ? rawAppUrl : 'https://pulito.trade';
  const typeLabel = feedback.type === 'callback' ? 'Замовлення дзвінка' : 'Звернення з форми';
  const subjectLine = `[${typeLabel}] ${feedback.subject ?? 'Без теми'} — ${feedback.name}`;

  const html = `
    <p>Надійшло нове звернення:</p>
    <ul>
      <li><strong>Тип:</strong> ${typeLabel}</li>
      <li><strong>Ім'я:</strong> ${escapeHtml(feedback.name)}</li>
      ${feedback.email ? `<li><strong>Email:</strong> ${escapeHtml(feedback.email)}</li>` : ''}
      ${feedback.phone ? `<li><strong>Телефон:</strong> ${escapeHtml(feedback.phone)}</li>` : ''}
      ${feedback.subject ? `<li><strong>Тема:</strong> ${escapeHtml(feedback.subject)}</li>` : ''}
    </ul>
    <p><strong>Повідомлення:</strong></p>
    <blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555">${escapeHtml(feedback.message)}</blockquote>
    <p><a href="${APP_URL}/admin/feedback" style="display:inline-block;padding:10px 20px;background:#0066cc;color:#fff;text-decoration:none;border-radius:6px">Відкрити в адмін-панелі</a></p>
  `;

  // Send in parallel; one failure doesn't abort the rest. We don't await Promise.all
  // failures — `sendEmail` already swallows transient errors and logs.
  await Promise.allSettled(
    recipients.map((r) => sendEmail({ to: r.email, subject: subjectLine, html })),
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function getFeedbackList(filters: {
  page: number;
  limit: number;
  type?: 'form' | 'callback';
  status?: 'new_feedback' | 'processed' | 'rejected';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Prisma.FeedbackWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    // Search across all customer-supplied free-text columns. Without this an
    // admin chasing a complaint by phone number or "broken link" mention has
    // to scroll the whole list manually.
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search, mode: 'insensitive' } },
      { message: { contains: filters.search, mode: 'insensitive' } },
      { subject: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
      include: { processor: { select: { id: true, fullName: true } } },
    }),
    prisma.feedback.count({ where }),
  ]);

  return { items, total };
}

export async function updateFeedbackStatus(
  id: number,
  status: 'processed' | 'rejected',
  processedBy: number,
) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new FeedbackError("Зворотний зв'язок не знайдено", 404);

  return prisma.feedback.update({
    where: { id },
    data: { status, processedBy, processedAt: new Date() },
  });
}

/**
 * Send a reply email to the customer and mark the feedback as processed.
 * Refuses if there's no email on file. Operator picks the template + can
 * tweak the body before sending.
 *
 * The Feedback model doesn't have a `repliedAt` column — we re-use `status`
 * and `processedAt` for the same purpose to avoid a schema change.
 */
export async function sendFeedbackReply(
  id: number,
  subject: string,
  bodyHtml: string,
  processedBy: number,
  opts?: { force?: boolean },
) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new FeedbackError("Зворотний зв'язок не знайдено", 404);
  if (!feedback.email) {
    throw new FeedbackError('У клієнта немає email — надішліть відповідь іншим каналом', 400);
  }
  // Refuse to re-send unless caller explicitly opts in. Without this guard
  // a double-click on the "Send reply" button can spam the customer (and
  // earn the shop a CAN-SPAM / DSGVO complaint).
  if (feedback.status === 'processed' && !opts?.force) {
    throw new FeedbackError(
      'Звернення вже оброблене. Якщо потрібно надіслати повторну відповідь, увімкніть «force».',
      409,
    );
  }

  try {
    // Sanitize before sending: a compromised manager account would otherwise
    // be able to embed phishing links / tracking pixels in emails sent from
    // the store domain. Allow only the same HTML subset as product descriptions.
    await sendEmail({
      to: feedback.email,
      subject,
      html: sanitizeHtml(bodyHtml),
    });
  } catch (err) {
    throw new FeedbackError(
      `Не вдалося надіслати email: ${err instanceof Error ? err.message : 'невідома помилка'}`,
      502,
    );
  }

  return prisma.feedback.update({
    where: { id },
    data: { status: 'processed', processedBy, processedAt: new Date() },
  });
}
