import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { uploadFile } from '@/lib/storage';
import sharp from 'sharp';
import { validateFileType } from '@/utils/file-validation';

const MAX_IMAGES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1200;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const id = Number(request.url.split('/reviews/')[1]?.split('/')[0]);
    if (!id) return errorResponse('Невірний ID', 400);

    // Verify review belongs to user
    const review = await prisma.review.findFirst({
      where: { id, userId: user.id },
      select: { id: true, images: true },
    });

    if (!review) {
      return errorResponse('Відгук не знайдено', 404);
    }

    const existingImages = (review.images as string[]) || [];
    if (existingImages.length >= MAX_IMAGES) {
      return errorResponse(`Максимум ${MAX_IMAGES} фото`, 400);
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return errorResponse('Файл не надано', 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse('Дозволені формати: JPEG, PNG, WebP', 400);
    }

    if (file.size > MAX_SIZE) {
      return errorResponse('Максимальний розмір файлу: 5MB', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes (client-declared file.type is NOT trusted) and
    // re-encode through sharp to strip polyglot/EXIF payloads — mirrors
    // /reviews/upload. Without this, a file declared image/png whose body is
    // HTML/SVG-with-script would be stored and served with that type (stored-XSS).
    const { valid } = await validateFileType(buffer, ALLOWED_TYPES);
    if (!valid) {
      return errorResponse('Вміст файлу не відповідає заявленому формату', 400);
    }
    const processed = await sharp(buffer)
      .resize(MAX_WIDTH, MAX_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const fileName = `reviews/${review.id}/${Date.now()}.webp`;

    const url = await uploadFile(fileName, processed, 'image/webp');

    const updatedImages = [...existingImages, url];
    await prisma.review.update({
      where: { id: review.id },
      data: { images: updatedImages },
    });

    return successResponse({ url, totalImages: updatedImages.length });
  } catch {
    return errorResponse('Помилка завантаження зображення', 500);
  }
});
