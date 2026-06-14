import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

/** Recent consignment sync runs for a channel — feeds the sync-history screen. */
export const GET = withRole(
  'manager',
  'admin',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const logs = await prisma.supplierSyncLog.findMany({
      where: { supplierId: numId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        itemsTotal: true,
        itemsUpdated: true,
        itemsUnmatched: true,
        errorLog: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });
    return successResponse(logs);
  } catch (err) {
    logger.error('[admin/supplier-channels/[id]/sync-logs] failed', { error: err });
    return errorResponse('Не вдалося завантажити лог', 500);
  }
});
