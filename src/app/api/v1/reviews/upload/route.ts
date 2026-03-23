import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { withAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { uploadFile } from '@/lib/storage';
import { validateFileType } from '@/utils/file-validation';

const MAX_IMAGES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB per image
const MAX_WIDTH = 1200;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files.length) {
      return errorResponse('Файли не надано', 400);
    }

    if (files.length > MAX_IMAGES) {
      return errorResponse(`Максимум ${MAX_IMAGES} фото`, 400);
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return errorResponse(
          `Непідтримуваний формат: ${file.name}. Дозволені: JPEG, PNG, WebP`,
          400
        );
      }

      if (file.size > MAX_SIZE) {
        return errorResponse(
          `Файл ${file.name} перевищує максимальний розмір 5MB`,
          400
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      const { valid } = await validateFileType(buffer, ALLOWED_TYPES);
      if (!valid) {
        return errorResponse(
          `Вміст файлу ${file.name} не відповідає заявленому формату`,
          400
        );
      }

      // Resize to max 1200px and compress as WebP
      const processed = await sharp(buffer)
        .resize(MAX_WIDTH, MAX_WIDTH, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const key = `reviews/${user.id}/${timestamp}_${randomSuffix}.webp`;

      const url = await uploadFile(key, processed, 'image/webp');
      urls.push(url);
    }

    return successResponse({ urls });
  } catch {
    return errorResponse('Помилка завантаження зображень', 500);
  }
});
