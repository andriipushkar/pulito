import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const DELETE = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { user, params }) => {
  try {
    const { id } = (await params!) as { id: string };
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return errorResponse('Невалідний ID', 400);
    }
    const result = await prisma.reportTemplate.updateMany({
      where: { id: numId, createdBy: user.id },
      data: { isActive: false },
    });
    if (result.count === 0) return errorResponse('Підписку не знайдено', 404);
    return successResponse({ ok: true });
  } catch (err) {
    logger.error('[admin/reports/subscriptions/[id]] DELETE failed', { error: err });
    return errorResponse('Не вдалося видалити підписку', 500);
  }
});
