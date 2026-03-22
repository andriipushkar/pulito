import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { uploadFile } from '@/lib/storage';

const MAX_IMAGES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
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
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const fileName = `reviews/${review.id}/${Date.now()}.${ext}`;

    const url = await uploadFile(buffer, fileName, file.type);

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
