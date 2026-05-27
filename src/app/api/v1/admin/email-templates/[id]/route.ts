import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { sanitizeHtml } from '@/utils/sanitize';
import { logAudit } from '@/services/audit';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const template = await prisma.emailTemplate.findUnique({ where: { id: numId } });
    if (!template) return errorResponse('Шаблон не знайдено', 404);

    return successResponse(template);
  } catch (error) {
    console.error('[Email Template Detail]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const existing = await prisma.emailTemplate.findUnique({ where: { id: numId } });
    if (!existing) return errorResponse('Шаблон не знайдено', 404);

    const body = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if ('subject' in body) {
      const subj = String(body.subject ?? '');
      if (subj.length < 1 || subj.length > 300) {
        return errorResponse('Subject має бути від 1 до 300 символів', 422);
      }
      data.subject = subj;
    }
    if ('bodyHtml' in body) {
      const raw = String(body.bodyHtml);
      if (raw.length > 200_000) {
        return errorResponse('bodyHtml занадто великий (макс 200 KB)', 422);
      }
      data.bodyHtml = sanitizeHtml(raw);
    }
    if ('bodyText' in body) {
      const t = body.bodyText == null ? null : String(body.bodyText);
      if (t && t.length > 50_000) {
        return errorResponse('bodyText занадто великий (макс 50 KB)', 422);
      }
      data.bodyText = t;
    }
    if ('isActive' in body) data.isActive = body.isActive;
    if ('isMarketing' in body) data.isMarketing = body.isMarketing;

    if (Object.keys(data).length === 0) {
      return errorResponse('Немає даних для оновлення', 400);
    }

    // Save version history if content changed
    if (data.subject || data.bodyHtml) {
      await prisma.emailTemplateVersion.create({
        data: {
          templateId: numId,
          version: existing.version,
          subject: existing.subject,
          bodyHtml: existing.bodyHtml,
        },
      });
      data.version = existing.version + 1;
    }

    const template = await prisma.emailTemplate.update({
      where: { id: numId },
      data,
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'email_template',
      entityId: numId,
      details: { fields: Object.keys(data) },
    });

    return successResponse(template);
  } catch (error) {
    console.error('[Email Template Update]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (_request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    // Refuse to delete a template that an active campaign is configured to
    // send. Otherwise the next campaign tick would crash on a missing FK
    // and email customers nothing.
    const inUse = await prisma.campaignRule.count({
      where: { emailTemplateId: numId, isActive: true },
    });
    if (inUse > 0) {
      return errorResponse(
        `Шаблон використовується активними кампаніями (${inUse}). Спочатку деактивуйте їх.`,
        409,
      );
    }

    await prisma.emailTemplate.delete({ where: { id: numId } });
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'email_template',
      entityId: numId,
    });
    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[Email Template Delete]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
