import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { validateFileType } from '@/utils/file-validation';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const formData = await request.formData();
      const file = formData.get('image') as File | null;

      if (!file || !(file instanceof File)) {
        return errorResponse('Файл не надано', 400);
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return errorResponse('Непідтримуваний формат. Дозволені: JPG, PNG, WebP', 400);
      }

      if (file.size > 5 * 1024 * 1024) {
        return errorResponse('Файл занадто великий (макс. 5MB)', 400);
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'banners');
      await fs.mkdir(uploadDir, { recursive: true });

      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `banner-${id}-${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, filename);

      const buffer = Buffer.from(await file.arrayBuffer());

      const { valid } = await validateFileType(buffer, allowedTypes);
      if (!valid) {
        return errorResponse('Вміст файлу не відповідає заявленому формату', 400);
      }

      await fs.writeFile(filePath, buffer);

      const imageUrl = `/uploads/banners/${filename}`;
      try {
        const banner = await prisma.banner.update({
          where: { id: numId },
          data: { imageDesktop: imageUrl },
        });
        await logAudit({
          userId: user.id,
          actionType: 'data_update',
          entityType: 'banner',
          entityId: numId,
          details: { field: 'imageDesktop', filename },
        });
        return successResponse(banner);
      } catch (dbErr: unknown) {
        // Roll back the file we just wrote so we don't leak orphan uploads.
        await fs.unlink(filePath).catch(() => {});
        if (dbErr && typeof dbErr === 'object' && 'code' in dbErr && (dbErr as { code: string }).code === 'P2025') {
          return errorResponse('Банер не знайдено', 404);
        }
        throw dbErr;
      }
    } catch (err) {
      logger.error('[admin/banners/[id]/upload] POST failed', { error: err });
      return errorResponse('Помилка завантаження зображення', 500);
    }
  }
);
