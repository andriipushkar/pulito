import { prisma } from '@/lib/prisma';
import { sendEmail } from './email';
import { getCustomerSegmentation } from './analytics-reports';
import { generateUnsubscribeToken } from './subscriber';
import { env } from '@/config/env';
import type { CampaignFrequency, CampaignRule } from '../../generated/prisma';

// Advisory-lock helpers used to serialise concurrent runs of the same
// campaign rule. Without these, two cron pods could both read the
// "alreadySent" list at the same time and dispatch duplicate emails.
// Lock key namespace: 0x43414d50 ("CAMP") + rule id.
const CAMPAIGN_LOCK_NS = 0x43414d50;

async function tryAcquireCampaignLock(ruleId: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT pg_try_advisory_lock(${CAMPAIGN_LOCK_NS}::int, ${ruleId}::int) AS ok
  `;
  return rows[0]?.ok ?? false;
}

async function releaseCampaignLock(ruleId: number): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${CAMPAIGN_LOCK_NS}::int, ${ruleId}::int)
  `;
}

// Escape user-controlled values before injecting them into an HTML template.
// Without this, a user with fullName="<img onerror=…>" gets that payload
// pasted verbatim into the outbound email body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────
// Campaign CRUD
// ──────────────────────────────────────────

interface CampaignRuleFilters {
  isActive?: boolean;
  rfmSegment?: string;
}

export async function getCampaignRules(filters?: CampaignRuleFilters) {
  const where: Record<string, unknown> = {};
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.rfmSegment) where.rfmSegment = filters.rfmSegment;

  return prisma.campaignRule.findMany({
    where,
    include: {
      emailTemplate: { select: { id: true, templateKey: true, subject: true, isActive: true } },
      _count: { select: { logs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

interface CreateCampaignRuleInput {
  name: string;
  rfmSegment: string;
  emailTemplateId: number;
  frequency?: CampaignFrequency;
  isActive?: boolean;
}

export async function createCampaignRule(data: CreateCampaignRuleInput) {
  // Validate template exists
  const template = await prisma.emailTemplate.findUnique({ where: { id: data.emailTemplateId } });
  if (!template) throw new CampaignError('Email шаблон не знайдено', 404);

  return prisma.campaignRule.create({
    data: {
      name: data.name,
      rfmSegment: data.rfmSegment,
      emailTemplateId: data.emailTemplateId,
      frequency: data.frequency ?? 'once',
      isActive: data.isActive ?? true,
    },
    include: {
      emailTemplate: { select: { id: true, templateKey: true, subject: true, isActive: true } },
    },
  });
}

interface UpdateCampaignRuleInput {
  name?: string;
  rfmSegment?: string;
  emailTemplateId?: number;
  frequency?: CampaignFrequency;
  isActive?: boolean;
}

export async function updateCampaignRule(id: number, data: UpdateCampaignRuleInput) {
  const existing = await prisma.campaignRule.findUnique({ where: { id } });
  if (!existing) throw new CampaignError('Кампанію не знайдено', 404);

  if (data.emailTemplateId) {
    const template = await prisma.emailTemplate.findUnique({ where: { id: data.emailTemplateId } });
    if (!template) throw new CampaignError('Email шаблон не знайдено', 404);
  }

  return prisma.campaignRule.update({
    where: { id },
    data,
    include: {
      emailTemplate: { select: { id: true, templateKey: true, subject: true, isActive: true } },
    },
  });
}

export async function deleteCampaignRule(id: number): Promise<void> {
  const existing = await prisma.campaignRule.findUnique({ where: { id } });
  if (!existing) throw new CampaignError('Кампанію не знайдено', 404);

  await prisma.campaignRule.delete({ where: { id } });
}

// ──────────────────────────────────────────
// Campaign Processing
// ──────────────────────────────────────────

const FREQUENCY_MS: Record<CampaignFrequency, number> = {
  once: Infinity,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function shouldRunCampaign(rule: CampaignRule, now: Date = new Date()): boolean {
  if (!rule.isActive) return false;

  // "once" campaigns: run only if never run before
  if (rule.frequency === 'once') return !rule.lastRunAt;

  // Recurring: check if enough time has passed
  if (!rule.lastRunAt) return true;
  const elapsed = now.getTime() - rule.lastRunAt.getTime();
  return elapsed >= FREQUENCY_MS[rule.frequency];
}

export async function processCampaigns(): Promise<{ sent: number; skipped: number }> {
  const now = new Date();
  let sent = 0;
  let skipped = 0;

  const rules = await prisma.campaignRule.findMany({
    where: { isActive: true },
    include: {
      emailTemplate: true,
    },
  });

  // Get all customer segments once
  const segmentation = await getCustomerSegmentation();

  for (const rule of rules) {
    if (!shouldRunCampaign(rule, now)) {
      skipped++;
      continue;
    }

    // Skip if another runner already holds the lock — prevents duplicate sends
    // when two cron pods fire at the same minute.
    const acquired = await tryAcquireCampaignLock(rule.id);
    if (!acquired) {
      skipped++;
      continue;
    }

    try {
    if (!rule.emailTemplate.isActive) {
      skipped++;
      continue;
    }

    // Find customers in the matching segment
    const segment = segmentation.segments.find((s) => s.segment === rule.rfmSegment);
    if (!segment || segment.customers.length === 0) {
      // Update lastRunAt even if no customers to prevent re-checking too soon
      await prisma.campaignRule.update({
        where: { id: rule.id },
        data: { lastRunAt: now },
      });
      skipped++;
      continue;
    }

    // Get full user list for this segment (segment.customers is capped at 10 in getCustomerSegmentation)
    // We need all users' IDs from the segment, so we use the userId list
    const userIds = segment.customers.map((c) => c.userId);

    // Filter out users who already received this campaign (for "once" frequency)
    // For recurring, filter those who received it within the current frequency window
    const sinceDate =
      rule.frequency === 'once'
        ? new Date(0) // all time
        : new Date(now.getTime() - FREQUENCY_MS[rule.frequency]);

    const alreadySent = await prisma.campaignLog.findMany({
      where: {
        ruleId: rule.id,
        userId: { in: userIds },
        sentAt: { gte: sinceDate },
      },
      select: { userId: true },
    });
    const alreadySentUserIds = new Set(alreadySent.map((l) => l.userId));

    // Get emails for users who haven't received the campaign yet
    const usersToEmail = await prisma.user.findMany({
      where: {
        id: { in: userIds.filter((id) => !alreadySentUserIds.has(id)) },
        isBlocked: false,
      },
      select: { id: true, email: true, fullName: true },
    });

    for (const user of usersToEmail) {
      try {
        // Replace template variables — escape user-controlled values so a
        // crafted fullName like `<img onerror=...>` can't pop XSS in mail.
        const html = rule.emailTemplate.bodyHtml
          .replace(/\{\{fullName\}\}/g, escapeHtml(user.fullName || ''))
          .replace(/\{\{email\}\}/g, escapeHtml(user.email));

        const unsubToken = generateUnsubscribeToken(user.email);
        const unsubUrl = `${env.APP_URL}/unsubscribe?token=${unsubToken}`;
        const htmlWithUnsub =
          html +
          `<div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb"><a href="${unsubUrl}" style="color:#6b7280;font-size:12px">Відписатися від розсилки</a></div>`;

        await sendEmail({
          to: user.email,
          subject: rule.emailTemplate.subject,
          html: htmlWithUnsub,
          text: rule.emailTemplate.bodyText || undefined,
          listUnsubscribe: unsubUrl,
        });

        await prisma.campaignLog.create({
          data: {
            ruleId: rule.id,
            userId: user.id,
            sentAt: now,
          },
        });

        sent++;
      } catch (error) {
        console.error(`[Campaign] Failed to send to user ${user.id} for rule ${rule.id}:`, error);
        skipped++;
      }
    }

    // Update lastRunAt
    await prisma.campaignRule.update({
      where: { id: rule.id },
      data: { lastRunAt: now },
    });
    } finally {
      await releaseCampaignLock(rule.id);
    }
  }

  return { sent, skipped };
}

/**
 * Run a single campaign rule immediately, regardless of its `lastRunAt`
 * or frequency window. Useful for admin "Send now" trigger.
 * Returns count of emails dispatched + skipped.
 */
export async function runCampaignNow(ruleId: number): Promise<{ sent: number; skipped: number }> {
  const acquired = await tryAcquireCampaignLock(ruleId);
  if (!acquired) {
    throw new CampaignError('Кампанія вже виконується іншим процесом', 409);
  }
  try {
  const rule = await prisma.campaignRule.findUnique({
    where: { id: ruleId },
    include: { emailTemplate: true },
  });
  if (!rule) throw new CampaignError('Кампанію не знайдено', 404);
  if (!rule.emailTemplate.isActive) throw new CampaignError('Email-шаблон неактивний', 400);

  const segmentation = await getCustomerSegmentation();
  const segment = segmentation.segments.find((s) => s.segment === rule.rfmSegment);
  if (!segment || segment.customers.length === 0) {
    await prisma.campaignRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const now = new Date();
  const userIds = segment.customers.map((c) => c.userId);

  // For "once" frequency, still skip users who already received this campaign
  // to avoid double-sending. For others, allow re-send when admin triggers manually.
  const alreadySent =
    rule.frequency === 'once'
      ? await prisma.campaignLog.findMany({
          where: { ruleId: rule.id, userId: { in: userIds } },
          select: { userId: true },
        })
      : [];
  const alreadySentUserIds = new Set(alreadySent.map((l) => l.userId));

  const usersToEmail = await prisma.user.findMany({
    where: {
      id: { in: userIds.filter((id) => !alreadySentUserIds.has(id)) },
      isBlocked: false,
    },
    select: { id: true, email: true, fullName: true },
  });

  for (const user of usersToEmail) {
    try {
      const html = rule.emailTemplate.bodyHtml
        .replace(/\{\{fullName\}\}/g, escapeHtml(user.fullName || ''))
        .replace(/\{\{email\}\}/g, escapeHtml(user.email));
      const unsubToken = generateUnsubscribeToken(user.email);
      const unsubUrl = `${env.APP_URL}/unsubscribe?token=${unsubToken}`;
      const htmlWithUnsub =
        html +
        `<div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb"><a href="${unsubUrl}" style="color:#6b7280;font-size:12px">Відписатися від розсилки</a></div>`;
      await sendEmail({
        to: user.email,
        subject: rule.emailTemplate.subject,
        html: htmlWithUnsub,
        text: rule.emailTemplate.bodyText || undefined,
        listUnsubscribe: unsubUrl,
      });
      await prisma.campaignLog.create({ data: { ruleId: rule.id, userId: user.id, sentAt: now } });
      sent++;
    } catch (err) {
      console.error(`[Campaign:runNow] failed for user ${user.id}:`, err);
      skipped++;
    }
  }

  await prisma.campaignRule.update({ where: { id: rule.id }, data: { lastRunAt: now } });
  return { sent, skipped };
  } finally {
    await releaseCampaignLock(ruleId);
  }
}

// ──────────────────────────────────────────
// Error class
// ──────────────────────────────────────────

export class CampaignError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'CampaignError';
  }
}
