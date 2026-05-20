import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { importProducts, ImportError } from '@/services/import';
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
    if (!ext || !['xlsx', 'xls', 'csv', 'xml', 'yml'].includes(ext)) {
      return errorResponse('Підтримуються формати .xlsx, .xls, .csv, .xml, .yml', 400);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return errorResponse('Максимальний розмір файлу: 10 МБ', 400);
    }

    const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importProducts(buffer, file.name, user.id, { dryRun });

    if (!dryRun) {
      await logAudit({
        userId: user.id,
        actionType: 'import_action',
        entityType: 'product',
        entityId: result.importLogId,
        details: { filename: file.name, size: file.size },
        ipAddress: getClientIp(request),
      });

      // Revalidate all cached pages after bulk import
      try {
        revalidatePath('/catalog');
        revalidatePath('/');
      } catch { /* best-effort */ }

      // Trigger full Typesense reindex after import. Fire-and-forget so the HTTP
      // response isn't blocked by indexing, but log failures so we notice when
      // search drifts out of sync after a bulk import.
      import('@/services/typesense')
        .then((ts) => ts.indexAllProducts())
        .catch((err) => {
          logger.error('[admin/import/products] Typesense reindex failed', { error: err });
        });
    }

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ImportError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/import/products] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
