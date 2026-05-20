import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { updateThemeSettings, ThemeError } from '@/services/theme';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

export const PUT = withRole2fa('admin')(
  async (request: NextRequest, { params, user }) => {
    try {
      const { id } = await params!;
      const themeId = Number(id);

      if (!themeId || isNaN(themeId)) {
        return errorResponse('Невалідний ID теми', 400);
      }

      const body = await request.json();
      const { customSettings } = body;

      if (!customSettings || typeof customSettings !== 'object') {
        return errorResponse('customSettings є обовʼязковим обʼєктом', 400);
      }

      const theme = await updateThemeSettings(themeId, customSettings);
      await logAudit({
        userId: user.id,
        actionType: 'data_update',
        entityType: 'theme',
        entityId: themeId,
        details: { keys: Object.keys(customSettings) },
      });
      return successResponse(theme);
    } catch (error) {
      if (error instanceof ThemeError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/themes/[id]] PUT failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
