import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { paginatedResponse, successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Number(params.limit) || 50);
    // Default sort by lastSeen desc — admin cares about active broken links,
    // not historical ones that may already be fixed.
    const sortByCount = params.sort === 'count';

    const [logs, total] = await Promise.all([
      prisma.notFoundLog.findMany({
        orderBy: sortByCount ? { count: 'desc' } : { lastSeenAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notFoundLog.count(),
    ]);

    return paginatedResponse(logs, total, page, limit);
  } catch (err) {
    logger.error('[admin/not-found-log] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const id = Number(params.id);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    if (id) {
      await prisma.notFoundLog.delete({ where: { id } });
      await logAudit({
        userId: user.id,
        actionType: 'data_delete',
        entityType: 'not_found_log',
        entityId: id,
        ipAddress: ip,
      });
      return successResponse({ deleted: 1 });
    }

    // Mass-delete must be opt-in: a stray DELETE with no params would
    // otherwise nuke the whole history. UI sends `?confirm=all` only after
    // explicit user confirmation; an accidental fetch is now safe.
    if (params.confirm !== 'all') {
      return errorResponse(
        'Для очищення усього логу передайте `?confirm=all` (захист від випадкового кліку)',
        400,
      );
    }

    const { count } = await prisma.notFoundLog.deleteMany({});
    await logAudit({
      userId: user.id,
      actionType: 'data_delete',
      entityType: 'not_found_log_bulk',
      details: { deleted: count },
      ipAddress: ip,
    });
    return successResponse({ deleted: count });
  } catch (err) {
    logger.error('[admin/not-found-log] DELETE failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
