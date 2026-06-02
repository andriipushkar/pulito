import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getDeliveryDate, NovaPoshtaError } from '@/services/nova-poshta';
import { getNovaPoshtaSenderCityRef } from '@/services/integration-credentials';
import { redis, CACHE_TTL } from '@/lib/redis';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

const VALID_SERVICE = ['WarehouseWarehouse', 'WarehouseDoors', 'DoorsWarehouse', 'DoorsDoors'];

// Estimate the delivery DATE (ETA) for a recipient city. Lighter than the
// cost estimate — used where only the arrival date matters.
export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.publicDelivery);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }

    const sp = request.nextUrl.searchParams;
    const city = sp.get('city');
    if (!city) return errorResponse('Вкажіть місто отримувача (city)', 400);

    const serviceTypeParam = sp.get('serviceType') || 'WarehouseWarehouse';
    const serviceType = (
      VALID_SERVICE.includes(serviceTypeParam) ? serviceTypeParam : 'WarehouseWarehouse'
    ) as 'WarehouseWarehouse' | 'WarehouseDoors' | 'DoorsWarehouse' | 'DoorsDoors';

    const citySender = await getNovaPoshtaSenderCityRef();
    const cacheKey = `delivery:date:${citySender}:${serviceType}:${city}`;
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) return successResponse({ deliveryDate: cached });

    const deliveryDate = await getDeliveryDate({
      citySender,
      cityRecipient: city,
      serviceType,
    });

    if (deliveryDate) {
      await redis.setex(cacheKey, CACHE_TTL.SHORT, deliveryDate).catch(() => {});
    }

    return successResponse({ deliveryDate });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка розрахунку дати доставки', 500);
  }
}
