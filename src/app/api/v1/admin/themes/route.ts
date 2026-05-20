import { NextRequest } from 'next/server';
import { withRole, withRole2fa } from '@/middleware/auth';
import { getAllThemes, uploadTheme, ThemeError } from '@/services/theme';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const GET = withRole('admin')(
  async (_request: NextRequest) => {
    try {
      const themes = await getAllThemes();
      return successResponse(themes);
    } catch (error) {
      if (error instanceof ThemeError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/themes] GET failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const POST = withRole2fa('admin')(
  async (request: NextRequest, { user }) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return errorResponse('Файл не надано', 400);
      }

      if (!file.name.endsWith('.zip')) {
        return errorResponse('Підтримуються лише ZIP-архіви', 400);
      }

      if (file.size > 10 * 1024 * 1024) {
        return errorResponse('Максимальний розмір файлу: 10 МБ', 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      // Magic-byte check: ZIP files start with PK\x03\x04. Stops a renamed
      // .exe or HTML from being processed as a theme even if extension matches.
      if (buffer.length < 4 || !(buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) {
        return errorResponse('Файл не є валідним ZIP-архівом', 400);
      }
      const theme = await uploadTheme(buffer, file.name);
      await logAudit({
        userId: user.id,
        actionType: 'data_create',
        entityType: 'theme',
        entityId: theme.id,
        details: { fileName: file.name, size: file.size },
      });

      return successResponse(theme, 201);
    } catch (error) {
      if (error instanceof ThemeError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/themes] POST failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
