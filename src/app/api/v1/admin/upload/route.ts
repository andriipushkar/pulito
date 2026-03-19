import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { validateFileType } from '@/utils/file-validation';
import { sanitizeImage } from '@/utils/image-sanitizer';
import { promises as fs } from 'fs';
import path from 'path';

const ALLOWED_FOLDERS = ['publications', 'general'] as const;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const folder = (formData.get('folder') as string) || 'general';

      if (!file || !(file instanceof File)) {
        return errorResponse('Файл не надано', 400);
      }

      if (!ALLOWED_FOLDERS.includes(folder as typeof ALLOWED_FOLDERS[number])) {
        return errorResponse('Невалідна папка', 400);
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return errorResponse('Непідтримуваний формат. Дозволені: JPG, PNG, WebP, GIF', 400);
      }

      if (file.size > MAX_SIZE) {
        return errorResponse('Файл занадто великий (макс. 5MB)', 400);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', folder);
      await fs.mkdir(uploadDir, { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());

      const { valid } = await validateFileType(buffer, ALLOWED_TYPES);
      if (!valid) {
        return errorResponse('Вміст файлу не відповідає заявленому формату', 400);
      }

      // Re-encode through sharp to strip EXIF/metadata and prevent polyglot attacks
      const sanitized = await sanitizeImage(buffer);
      const filename = `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const filePath = path.join(uploadDir, filename);

      await fs.writeFile(filePath, sanitized);

      return successResponse({ path: `/uploads/${folder}/${filename}` });
    } catch {
      return errorResponse('Помилка завантаження файлу', 500);
    }
  }
);
