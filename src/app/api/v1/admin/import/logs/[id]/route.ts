import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getImportLogById } from '@/services/import';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const log = await getImportLogById(numId);

      if (!log) {
        return errorResponse('Лог імпорту не знайдено', 404);
      }

      return successResponse(log);
    } catch (err) {
      logger.error('[admin/import/logs/[id]] GET failed', { error: err });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
