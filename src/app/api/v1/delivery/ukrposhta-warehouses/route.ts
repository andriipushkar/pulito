import { NextRequest } from 'next/server';
import {
  getPostOfficesByCityId,
  getPostOfficesByPostcode,
  UkrposhtaError,
} from '@/services/ukrposhta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

/**
 * List Ukrposhta post offices (відділення / ВПЗ) for a city.
 * Accepts either ?cityId= (from /ukrposhta-cities) or ?postcode=.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.publicDelivery);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const cityId = request.nextUrl.searchParams.get('cityId');
    const postcode = request.nextUrl.searchParams.get('postcode');

    if (!cityId && !postcode) {
      return errorResponse('Потрібен параметр cityId або postcode', 400);
    }

    const offices = cityId
      ? await getPostOfficesByCityId(cityId)
      : await getPostOfficesByPostcode(postcode!);

    return successResponse(offices);
  } catch (error) {
    if (error instanceof UkrposhtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка пошуку відділень Укрпошти', 500);
  }
}
