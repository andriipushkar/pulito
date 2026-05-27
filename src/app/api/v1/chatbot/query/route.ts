import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';
import { answer } from '@/services/chatbot';
import { logger } from '@/lib/logger';

const querySchema = z.object({
  message: z.string().min(2, 'Запит занадто короткий').max(500, 'Запит занадто довгий'),
});

export const POST = createApiHandler(RATE_LIMITS.api, async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const reply = await answer(parsed.data.message);
    return successResponse(reply);
  } catch (err) {
    logger.error('[chatbot/query] failed', { error: err });
    return errorResponse('Чат тимчасово недоступний', 500);
  }
});
