import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { parsePreview, ImportError } from '@/services/import';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('Файл не надано', 400);
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv', 'xml', 'yml'].includes(ext)) {
      return errorResponse('Підтримуються формати .xlsx, .xls, .csv, .xml, .yml', 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('Максимальний розмір файлу: 10 МБ', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = parsePreview(buffer);

    return successResponse(preview, 200);
  } catch (error) {
    if (error instanceof ImportError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/import/preview] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
