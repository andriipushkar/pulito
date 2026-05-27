import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/utils/api-response';
import { deliveryEstimateSchema } from '@/validators/delivery';
import { estimateDeliveryCost, NovaPoshtaError } from '@/services/nova-poshta';
import { redis, CACHE_TTL } from '@/lib/redis';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIp(request), RATE_LIMITS.publicDelivery);
    if (!rl.allowed) {
      return errorResponse(`Забагато запитів. Спробуйте через ${rl.retryAfter} с.`, 429);
    }
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = deliveryEstimateSchema.safeParse(params);

    if (!parsed.success) {
      return errorResponse('Невалідні параметри', 400);
    }

    const { method, city, total, weight } = parsed.data;

    // Free delivery threshold from settings
    const freeFrom = 1500;

    if (total >= freeFrom) {
      return successResponse({
        cost: 0,
        estimatedDays: '1-3 дні',
        freeFrom,
      });
    }

    if (method === 'ukrposhta') {
      // Ukrposhta flat-rate estimate (no API for price estimation)
      return successResponse({
        cost: weight <= 2 ? 45 : weight <= 10 ? 65 : 95,
        estimatedDays: '3-7 днів',
        freeFrom,
      });
    }

    // Nova Poshta estimation
    if (!city) {
      return successResponse({
        cost: null,
        estimatedDays: null,
        freeFrom,
      });
    }

    // Check Redis cache. Round weight/total to 1 decimal so floating-point
    // serialization differences (`1.1` vs `1.1000000000000001`) don't cause
    // cache misses for what is functionally the same query. Customers
    // adjusting cart by single units typically land on the same bucket.
    const wKey = (Math.round(weight * 10) / 10).toFixed(1);
    const tKey = (Math.round(total * 100) / 100).toFixed(2);
    const cacheKey = `delivery:estimate:${method}:${city}:${wKey}:${tKey}`;
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return successResponse({ ...JSON.parse(cached), freeFrom });
    }

    // Default sender city: Kyiv (common ref)
    const KYIV_REF = '8d5a980d-391c-11dd-90d9-001a92567626';

    const estimate = await estimateDeliveryCost({
      citySender: KYIV_REF,
      cityRecipient: city,
      weight,
      serviceType: 'WarehouseWarehouse',
      cost: total,
    });

    const result = {
      cost: estimate.cost,
      estimatedDays: estimate.estimatedDays,
    };

    // Cache for 60 seconds
    await redis.setex(cacheKey, CACHE_TTL.SHORT, JSON.stringify(result)).catch(() => {});

    return successResponse({ ...result, freeFrom });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка розрахунку вартості доставки', 500);
  }
}
