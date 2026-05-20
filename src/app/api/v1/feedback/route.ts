import { NextRequest } from 'next/server';
import { contactFormSchema } from '@/validators/feedback';
import { createFeedback } from '@/services/feedback';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';

export const POST = createApiHandler(
  RATE_LIMITS.sensitive,
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const parsed = contactFormSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 422);
      }

      const feedback = await createFeedback({
        ...parsed.data,
        type: 'form',
      });

      // Notify manager via Telegram
      import('@/services/telegram')
        .then((mod) => mod.notifyManagerFeedback({ ...parsed.data, type: 'form' }))
        .catch(() => {});

      return successResponse({ id: feedback.id, message: 'Повідомлення надіслано' }, 201);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  },
);
