import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getImportLogs } from '@/services/import';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20));

    const { logs, total } = await getImportLogs(page, limit);
    return paginatedResponse(logs, total, page, limit);
  } catch (err) {
    logger.error('[admin/import/logs] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
