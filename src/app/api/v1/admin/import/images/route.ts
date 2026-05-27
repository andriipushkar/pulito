import { NextRequest } from 'next/server';
import AdmZip from 'adm-zip';
import path from 'path';
import { withRole } from '@/middleware/auth';
import { processProductImage, deleteProductImage } from '@/services/image';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
// Cap on total decompressed bytes across all ZIP entries. Without this, a
// "zip-bomb" archive that's small on disk can expand to gigabytes in memory
// and OOM-kill the worker.
const MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function getMimeType(ext: string): string {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

async function findProductByCodeOrBarcode(identifier: string) {
  // Skip soft-deleted products in every lookup — otherwise an import re-attaches
  // new photos to a product that admin already discarded, and the photo storage
  // bill grows without anything ever showing them.
  const byCode = await prisma.product.findFirst({
    where: { code: identifier, deletedAt: null },
    select: { id: true },
  });
  if (byCode) return byCode;

  const byCodeCI = await prisma.product.findFirst({
    where: { code: { equals: identifier, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  });
  if (byCodeCI) return byCodeCI;

  if (/^\d{8,14}$/.test(identifier)) {
    const byBarcode = await prisma.product.findFirst({
      where: { barcode: identifier, deletedAt: null },
      select: { id: true },
    });
    if (byBarcode) return byBarcode;
  }

  return null;
}

async function processOneImage(
  imageBuffer: Buffer,
  filename: string,
): Promise<{ ok: boolean; error?: string }> {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return { ok: false, error: 'Непідтримуваний формат зображення' };
  }

  const productCode = path.basename(filename, ext);
  if (!productCode) {
    return { ok: false, error: 'Не вдалося визначити код товару з імені файлу' };
  }

  const product = await findProductByCodeOrBarcode(productCode);
  if (!product) {
    return {
      ok: false,
      error: `Товар з кодом або штрихкодом "${productCode}" не знайдено`,
    };
  }

  // Snapshot existing images before touching anything. We delete *after* the
  // new upload succeeds so a failed upload doesn't leave the product without
  // any image at all.
  const existingImages = await prisma.productImage.findMany({
    where: { productId: product.id },
    select: { id: true },
  });

  const mimeType = getMimeType(ext);
  await processProductImage(imageBuffer, mimeType, filename, product.id, true);

  for (const img of existingImages) {
    try {
      await deleteProductImage(img.id);
    } catch (err) {
      logger.warn('[admin/import/images] failed to delete old image', {
        imageId: img.id,
        error: err,
      });
    }
  }
  return { ok: true };
}

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminImport);
    if (!rl.allowed) {
      return errorResponse(
        `Забагато імпортів. Спробуйте через ${Math.ceil(rl.retryAfter / 60)} хв.`,
        429,
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('Файл не надано', 400);
    }

    const isZip = file.name.toLowerCase().endsWith('.zip');
    const ext = path.extname(file.name).toLowerCase();
    const isImage = ALLOWED_IMAGE_EXTENSIONS.includes(ext);

    if (!isZip && !isImage) {
      return errorResponse('Підтримуються формати: .zip, .jpg, .jpeg, .png, .webp', 400);
    }

    // Single image upload
    if (isImage) {
      if (file.size > MAX_IMAGE_SIZE) {
        return errorResponse('Максимальний розмір зображення: 5 МБ', 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await processOneImage(buffer, file.name);

      if (!result.ok) {
        return errorResponse(result.error!, 400);
      }

      await cacheInvalidate('products:*');
      return successResponse({ processedCount: 1, skippedCount: 0, errors: [] }, 200);
    }

    // ZIP upload
    if (file.size > MAX_ZIP_SIZE) {
      return errorResponse('Максимальний розмір ZIP: 50 МБ', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Zip-bomb guard: sum declared uncompressed sizes BEFORE touching any
    // entry data. AdmZip exposes header.size without decompressing.
    let declaredTotal = 0;
    for (const e of entries) {
      if (e.isDirectory) continue;
      declaredTotal += e.header.size;
      if (declaredTotal > MAX_DECOMPRESSED_SIZE) {
        return errorResponse('Архів задекларовано надто великим (zip-bomb захист)', 400);
      }
    }

    let processedCount = 0;
    let skippedCount = 0;
    let decompressedTotal = 0;
    const errors: { filename: string; message: string }[] = [];

    for (const entry of entries) {
      const entryName = entry.entryName;

      // Skip directories, __MACOSX, hidden files
      if (entry.isDirectory) continue;
      if (entryName.startsWith('__MACOSX/')) continue;
      const basename = path.basename(entryName);
      if (basename.startsWith('.')) continue;

      const entryExt = path.extname(basename).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(entryExt)) {
        skippedCount++;
        continue;
      }

      try {
        const imageBuffer = entry.getData();
        // Hard per-image cap and accumulated cap — defends against bombs that
        // misreport their uncompressed size in the central directory.
        if (imageBuffer.length > MAX_IMAGE_SIZE) {
          errors.push({ filename: basename, message: 'Файл перевищує 5 МБ' });
          skippedCount++;
          continue;
        }
        decompressedTotal += imageBuffer.length;
        if (decompressedTotal > MAX_DECOMPRESSED_SIZE) {
          return errorResponse('Розпакований розмір архіву перевищує ліміт', 400);
        }
        const result = await processOneImage(imageBuffer, basename);

        if (result.ok) {
          processedCount++;
        } else {
          errors.push({ filename: basename, message: result.error! });
          skippedCount++;
        }
      } catch (err) {
        errors.push({
          filename: basename,
          message: err instanceof Error ? err.message : 'Помилка обробки',
        });
        skippedCount++;
      }
    }

    if (processedCount > 0) {
      await cacheInvalidate('products:*');
    }
    return successResponse({ processedCount, skippedCount, errors }, 200);
  } catch (err) {
    logger.error('[admin/import/images] POST failed', { error: err });
    return errorResponse('Помилка обробки файлу', 500);
  }
});
