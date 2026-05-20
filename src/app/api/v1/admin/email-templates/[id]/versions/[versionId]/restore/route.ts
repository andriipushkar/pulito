import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

/**
 * POST — restore the template to a previous version. The current state is
 * snapshotted first (creating yet another version row) so the restore itself
 * is reversible — admins can never lose work by restoring.
 */
export const POST = withRole(
  'admin',
)(async (request: NextRequest, { params, user }) => {
  try {
    const { id, versionId } = await params!;
    const templateId = Number(id);
    const numVersionId = Number(versionId);
    if (isNaN(templateId) || isNaN(numVersionId)) return errorResponse('Невалідний ID', 400);

    const version = await prisma.emailTemplateVersion.findUnique({ where: { id: numVersionId } });
    if (!version || version.templateId !== templateId) {
      return errorResponse('Версію не знайдено', 404);
    }

    const current = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!current) return errorResponse('Шаблон не знайдено', 404);

    // Snapshot current state before overwriting.
    const lastVer = await prisma.emailTemplateVersion.findFirst({
      where: { templateId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastVer?.version ?? 0) + 1;

    await prisma.$transaction([
      prisma.emailTemplateVersion.create({
        data: {
          templateId,
          version: nextVersion,
          subject: current.subject,
          bodyHtml: current.bodyHtml,
          createdBy: user.id,
        },
      }),
      prisma.emailTemplate.update({
        where: { id: templateId },
        data: {
          subject: version.subject,
          bodyHtml: version.bodyHtml,
        },
      }),
    ]);

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'email_template',
      entityId: templateId,
      details: { restoredFromVersion: version.version, snapshotVersion: nextVersion },
      ipAddress: getClientIp(request),
    });

    return successResponse({ restored: true, restoredFromVersion: version.version });
  } catch (err) {
    logger.error('[admin/email-templates/versions/restore] POST failed', { error: err });
    return errorResponse('Не вдалося відновити', 500);
  }
});
