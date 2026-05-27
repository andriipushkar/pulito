import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const syncs = await prisma.integrationSync.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        direction: true,
        entityType: true,
        status: true,
        itemsTotal: true,
        itemsProcessed: true,
        itemsFailed: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });
    return successResponse(syncs);
  } catch (err) {
    logger.error('[admin/integration/syncs] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити синхронізації', 500);
  }
});
