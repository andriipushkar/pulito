import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole2fa } from '@/middleware/auth';
import { activateTheme, ThemeError } from '@/services/theme';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const PUT = withRole2fa('admin')(async (request: NextRequest, { params, user }) => {
  try {
    const { id } = await params!;
    const themeId = Number(id);

    if (!themeId || isNaN(themeId)) {
      return errorResponse('Невалідний ID теми', 400);
    }

    const theme = await activateTheme(themeId);
    await logAudit({
      userId: user.id,
      actionType: 'theme_change',
      entityType: 'theme',
      entityId: themeId,
      details: { name: theme.displayName },
      ipAddress: getClientIp(request),
    });
    // Theme change affects every storefront page — bust the layout cache
    // so CSS vars (colors, fonts) refresh immediately.
    try {
      revalidatePath('/', 'layout');
    } catch {
      /* best-effort */
    }
    return successResponse(theme);
  } catch (error) {
    if (error instanceof ThemeError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/themes/[id]/activate] PUT failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
