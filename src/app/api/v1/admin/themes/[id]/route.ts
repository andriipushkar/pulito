import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole2fa } from '@/middleware/auth';
import { updateThemeSettings, ThemeError } from '@/services/theme';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const updateSchema = z.object({
  customSettings: z.record(z.string(), z.string()),
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const themeId = Number(id);

    if (!themeId || isNaN(themeId)) {
      return errorResponse('Невалідний ID теми', 400);
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const { before, theme } = await updateThemeSettings(themeId, parsed.data.customSettings);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'theme',
      entityId: themeId,
      details: {
        before,
        afterKeys: Object.keys(parsed.data.customSettings),
      },
      ipAddress: getClientIp(request),
    });
    return successResponse(theme);
  } catch (error) {
    if (error instanceof ThemeError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/themes/[id]] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
