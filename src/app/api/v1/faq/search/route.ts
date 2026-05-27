import { NextRequest } from 'next/server';
import { searchFaq } from '@/services/faq';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';

export const GET = createApiHandler(RATE_LIMITS.api, async (request: NextRequest) => {
  try {
    const q = request.nextUrl.searchParams.get('q') ?? '';
    if (q.length < 2) return errorResponse('Запит має містити щонайменше 2 символи', 422);

    const results = await searchFaq(q);
    return successResponse(results);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
