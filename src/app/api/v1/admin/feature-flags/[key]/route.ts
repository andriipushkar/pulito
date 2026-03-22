import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { updateFlag, deleteFlag } from '@/services/feature-flag';
import { successResponse, errorResponse } from '@/utils/api-response';

export const PATCH = withRole('admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { key } = await params!;
      const body = await request.json();

      const flag = await updateFlag(key, {
        description: body.description,
        isEnabled: body.isEnabled,
        rolloutPercent: body.rolloutPercent,
        targetRoles: body.targetRoles,
        targetUserIds: body.targetUserIds,
      });

      return successResponse(flag);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse('Фічефлаг не знайдено', 404);
      }
      return errorResponse('Помилка оновлення фічефлага', 500);
    }
  }
);

export const DELETE = withRole('admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { key } = await params!;
      await deleteFlag(key);
      return successResponse({ deleted: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse('Фічефлаг не знайдено', 404);
      }
      return errorResponse('Помилка видалення фічефлага', 500);
    }
  }
);
