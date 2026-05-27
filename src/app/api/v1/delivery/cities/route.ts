import { NextRequest } from 'next/server';
import { searchCities, NovaPoshtaError } from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.publicDelivery);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const query = request.nextUrl.searchParams.get('q');
    if (!query || query.length < 2) {
      return errorResponse("Параметр q обов'язковий (мін. 2 символи)", 400);
    }

    const cities = await searchCities(query);
    return successResponse(cities);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка пошуку міст', 500);
  }
}
