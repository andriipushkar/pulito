import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { processProductImage, ImageError } from '@/services/image';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);

    const formData = await request.formData();
    const files = formData.getAll('images').filter((f): f is File => f instanceof File);
    const isMain = formData.get('isMain') === 'true';
    const removeBg = formData.get('removeBg') === 'true';

    if (files.length === 0) {
      return errorResponse('Зображення не надано', 400);
    }

    // Process files sequentially. We don't parallelize because:
    // 1) remove.bg has request-rate limits — bursts trigger 429s.
    // 2) Each Sharp pipeline opens multiple sub-processes; parallel runs
    //    can blow past CPU/memory on a small VPS.
    // Per-file errors are isolated so one bad photo doesn't fail the batch.
    const ok: unknown[] = [];
    const failed: { filename: string; error: string }[] = [];

    for (const [index, file] of files.entries()) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        // Only the first file in a batch can be set as main, otherwise
        // they'd all clobber each other's isMain flag.
        const image = await processProductImage(
          buffer,
          file.type,
          file.name,
          productId,
          isMain && index === 0,
          { removeBg },
        );
        ok.push(image);
      } catch (err) {
        const msg = err instanceof ImageError ? err.message : 'Внутрішня помилка обробки';
        failed.push({ filename: file.name, error: msg });
      }
    }

    await cacheInvalidate('products:*');

    // Backwards-compat: if a single file was uploaded successfully, return
    // it directly (existing FE code expects a single image object).
    if (files.length === 1 && ok.length === 1) {
      return successResponse(ok[0], 201);
    }

    return successResponse({ ok, failed, total: files.length }, ok.length > 0 ? 201 : 400);
  } catch (error) {
    if (error instanceof ImageError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
