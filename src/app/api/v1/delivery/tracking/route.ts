import { NextRequest } from 'next/server';
import { trackParcel as trackNovaPoshta, NovaPoshtaError } from '@/services/nova-poshta';
import { trackParcel as trackUkrposhta, UkrposhtaError } from '@/services/ukrposhta';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

/**
 * Public tracking endpoint. Used by the order/track shopfront page and any
 * email follow-up links. Two layers of access-control:
 *   1. Require BOTH orderNumber AND trackingNumber. A correct pair is hard
 *      to guess in bulk (orderNumber is ~6-8 chars; trackingNumber is the
 *      14-digit NP/Ukrposhta barcode). Knowing one alone gets you nowhere.
 *   2. IP rate-limit so an attacker can't burn through guesses fast enough
 *      to brute-force the pair.
 * Authenticated users still get a fast path — same checks, same data.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimit(ip, RATE_LIMITS.search);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте за хвилину.', 429);
    }

    const trackingNumber = request.nextUrl.searchParams.get('trackingNumber');
    const provider = request.nextUrl.searchParams.get('provider');
    const orderNumber = request.nextUrl.searchParams.get('orderNumber');

    if (!trackingNumber) {
      return errorResponse('trackingNumber is required', 400);
    }
    if (!provider || !['nova_poshta', 'ukrposhta'].includes(provider)) {
      return errorResponse('provider must be nova_poshta or ukrposhta', 400);
    }
    if (!orderNumber) {
      return errorResponse('orderNumber is required', 400);
    }

    // Pair-validation: confirm this (orderNumber, trackingNumber) combo
    // belongs to a real order. Stops bulk-TTN enumeration that previously
    // leaked recipient name/phone/address from NP for any guessed barcode.
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { trackingNumber: true, deliveryMethod: true },
    });
    if (!order || order.trackingNumber !== trackingNumber) {
      return errorResponse('Замовлення з таким TTN не знайдено', 404);
    }

    if (provider === 'nova_poshta') {
      const data = await trackNovaPoshta(trackingNumber);
      return successResponse({ provider, trackingNumber, status: data });
    }

    const data = await trackUkrposhta(trackingNumber);
    return successResponse({ provider, trackingNumber, status: data });
  } catch (error) {
    if (error instanceof NovaPoshtaError || error instanceof UkrposhtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
