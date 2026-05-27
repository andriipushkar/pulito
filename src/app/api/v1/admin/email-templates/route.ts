import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { sanitizeHtml } from '@/utils/sanitize';
import { logAudit } from '@/services/audit';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { templateKey: 'asc' },
    });
    return successResponse(templates);
  } catch (error) {
    console.error('[Email Templates List]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const { templateKey, subject, bodyHtml, bodyText, isMarketing } = body;

    if (!templateKey || !subject || !bodyHtml) {
      return errorResponse("templateKey, subject та bodyHtml обов'язкові", 400);
    }
    // Length caps — body up to 200 KB (transactional templates rarely
    // exceed 50 KB), subject up to 300 chars (RFC suggests ≤78 for ASCII;
    // 300 covers Unicode and a small margin).
    if (String(templateKey).length > 100) {
      return errorResponse('templateKey занадто довгий', 422);
    }
    if (String(subject).length > 300) {
      return errorResponse('subject має бути ≤300 символів', 422);
    }
    if (String(bodyHtml).length > 200_000) {
      return errorResponse('bodyHtml занадто великий (макс 200 KB)', 422);
    }
    if (bodyText && String(bodyText).length > 50_000) {
      return errorResponse('bodyText занадто великий (макс 50 KB)', 422);
    }

    const existing = await prisma.emailTemplate.findUnique({ where: { templateKey } });
    if (existing) {
      return errorResponse('Шаблон з таким ключем вже існує', 409);
    }

    const template = await prisma.emailTemplate.create({
      data: {
        templateKey,
        subject,
        // Sanitize at save-time so a compromised admin account can't seed
        // <script> into outbound mail. DOMPurify config in utils/sanitize.ts
        // already covers the safe tag/attr surface.
        bodyHtml: sanitizeHtml(bodyHtml),
        bodyText: bodyText || null,
        isMarketing: isMarketing || false,
      },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'email_template',
      entityId: template.id,
      details: { templateKey, isMarketing: !!isMarketing },
    });

    return successResponse(template);
  } catch (error) {
    console.error('[Email Template Create]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
