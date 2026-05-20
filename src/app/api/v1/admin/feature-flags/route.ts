import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { getAllFlags, createFlag } from '@/services/feature-flag';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin')(
  async () => {
    try {
      const flags = await getAllFlags();
      return successResponse(flags);
    } catch (err) {
      logger.error('[admin/feature-flags] GET failed', { error: err });
      return errorResponse('Помилка завантаження фічефлагів', 500);
    }
  }
);

export const POST = withRole2fa('admin')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      if (!body.key) {
        return errorResponse('Ключ фічефлага обов\'язковий', 400);
      }

      if (!/^[a-z0-9_-]+$/.test(body.key)) {
        return errorResponse('Ключ може містити лише a-z, 0-9, -, _', 400);
      }

      if (body.rolloutPercent !== undefined) {
        const p = Number(body.rolloutPercent);
        if (!Number.isInteger(p) || p < 0 || p > 100) {
          return errorResponse('rolloutPercent має бути цілим у діапазоні 0–100', 400);
        }
      }
      if (body.targetRoles !== undefined) {
        if (!Array.isArray(body.targetRoles) || !body.targetRoles.every((r: unknown) => typeof r === 'string')) {
          return errorResponse('targetRoles має бути масивом рядків', 400);
        }
      }
      if (body.targetUserIds !== undefined) {
        if (!Array.isArray(body.targetUserIds) || !body.targetUserIds.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
          return errorResponse('targetUserIds має бути масивом додатних цілих чисел', 400);
        }
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
      logger.error('[admin/feature-flags] POST failed', { error });
      return errorResponse('Помилка створення фічефлага', 500);
    }
  }
);
