import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { importPrices, ImportError } from '@/services/import';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const POST = withRole('manager', 'admin')(async (request: NextRequest, { user }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('Файл не надано. Завантажте Excel (.xlsx/.xls) або CSV файл', 400);
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      return errorResponse('Підтримуються формати .xlsx, .xls та .csv', 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return errorResponse('Максимальний розмір файлу: 10 МБ', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importPrices(buffer, file.name, user.id);

    await logAudit({
      userId: user.id,
      actionType: 'import_action',
      entityType: 'product',
      entityId: result.importLogId,
      details: { filename: file.name, size: file.size, mode: 'prices_only' },
      ipAddress: getClientIp(request),
    });

    try {
      revalidatePath('/catalog');
      revalidatePath('/');
    } catch {
      /* best-effort */
    }

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ImportError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/import/prices] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
