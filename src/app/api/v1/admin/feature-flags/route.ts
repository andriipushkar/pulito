import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getAllFlags, createFlag } from '@/services/feature-flag';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin')(
  async () => {
    try {
      const flags = await getAllFlags();
      return successResponse(flags);
    } catch {
      return errorResponse('Помилка завантаження фічефлагів', 500);
    }
  }
);

export const POST = withRole('admin')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      if (!body.key) {
        return errorResponse('Ключ фічефлага обов\'язковий', 400);
      }

      if (!/^[a-z0-9_-]+$/.test(body.key)) {
        return errorResponse('Ключ може містити лише a-z, 0-9, -, _', 400);
      }

      const flag = await createFlag({
        key: body.key,
        description: body.description,
        isEnabled: body.isEnabled,
        rolloutPercent: body.rolloutPercent,
        targetRoles: body.targetRoles,
        targetUserIds: body.targetUserIds,
      });

      return successResponse(flag, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique')) {
        return errorResponse('Фічефлаг з таким ключем вже існує', 409);
      }
      return errorResponse('Помилка створення фічефлага', 500);
    }
  }
);
