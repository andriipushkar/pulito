import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { isFeatureEnabled } from '@/services/feature-flag';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withOptionalAuth(
  async (request: NextRequest, { user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const key = searchParams.get('key');

      if (!key) {
        return errorResponse('Параметр key обов\'язковий', 400);
      }

      const enabled = await isFeatureEnabled(
        key,
        user?.id,
        user?.role
      );

      return successResponse({ enabled });
    } catch {
      return errorResponse('Помилка перевірки фічефлага', 500);
    }
  }
);
