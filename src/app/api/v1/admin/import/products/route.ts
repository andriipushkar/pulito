import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { importProducts, ImportError } from '@/services/import';
import { successResponse, errorResponse } from '@/utils/api-response';

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

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return errorResponse('Максимальний розмір файлу: 10 МБ', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importProducts(buffer, file.name, user.id);

    // Revalidate all cached pages after bulk import
    try {
      revalidatePath('/catalog');
      revalidatePath('/');
    } catch { /* best-effort */ }

    // Trigger full Typesense reindex after import
    import('@/services/typesense').then((ts) => ts.indexAllProducts()).catch(() => {});

    return successResponse(result, 200);
  } catch (error) {
    if (error instanceof ImportError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
