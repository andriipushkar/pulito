import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';
import { logger } from '@/lib/logger';

export class FeedbackError extends Error {
  constructor(
    message: string,
    public statusCode: number
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
}) {
  const created = await prisma.feedback.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      type: data.type,
      status: 'new_feedback',
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
  // and customers must never get internal escalations.
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['admin', 'manager'] },
      isBlocked: false,
      email: { not: '' },
    },
    select: { email: true },
  });
  if (recipients.length === 0) return;

  const APP_URL = process.env.APP_URL || 'https://pulito.trade';
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
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
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
  processedBy: number
) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new FeedbackError('Зворотний зв\'язок не знайдено', 404);

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
) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new FeedbackError("Зворотний зв'язок не знайдено", 404);
  if (!feedback.email) {
    throw new FeedbackError('У клієнта немає email — надішліть відповідь іншим каналом', 400);
  }

  try {
    await sendEmail({
      to: feedback.email,
      subject,
      html: bodyHtml,
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
