import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// GET — list version snapshots (newest first) so admin can compare/restore.
export const GET = withRole(
  'manager',
  'admin',
)(async (_req: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const versions = await prisma.emailTemplateVersion.findMany({
      where: { templateId: numId },
      orderBy: { version: 'desc' },
      take: 50,
    });
    return successResponse(versions);
  } catch (err) {
    logger.error('[admin/email-templates/[id]/versions] GET failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});
