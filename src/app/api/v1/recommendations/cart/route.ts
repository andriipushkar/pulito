import { NextRequest } from 'next/server';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';
import { getCartRecommendations } from '@/services/recommendation';
import { successResponse, errorResponse } from '@/utils/api-response';

interface RecommendationsRequest {
  productIds: number[];
  limit?: number;
}

export const POST = createApiHandler(RATE_LIMITS.api, async (request: NextRequest) => {
  try {
    const body = (await request.json()) as RecommendationsRequest;
    const productIds = Array.isArray(body.productIds)
      ? body.productIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 50)
      : [];
    const limit = Math.min(Math.max(body.limit ?? 4, 1), 10);

    const products = await getCartRecommendations(productIds, limit);
    return successResponse(products);
  } catch {
    return errorResponse('Помилка отримання рекомендацій', 500);
  }
});
