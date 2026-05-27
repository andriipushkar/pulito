import { NextRequest } from 'next/server';
import { getWarehouses, NovaPoshtaError } from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.publicDelivery);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const cityRef = request.nextUrl.searchParams.get('cityRef');
    if (!cityRef) {
      return errorResponse("Параметр cityRef обов'язковий", 400);
    }

    const search = request.nextUrl.searchParams.get('q') || undefined;
    const warehouses = await getWarehouses(cityRef, search);
    return successResponse(warehouses);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка отримання відділень', 500);
  }
}
