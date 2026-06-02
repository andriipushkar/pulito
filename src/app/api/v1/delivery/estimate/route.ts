import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/utils/api-response';
import { deliveryEstimateSchema } from '@/validators/delivery';
import { estimateDeliveryCost, NovaPoshtaError } from '@/services/nova-poshta';
import { estimateDeliveryCost as estimateUkrposhtaCost } from '@/services/ukrposhta';
import { getNovaPoshtaSenderCityRef } from '@/services/integration-credentials';
import { getSettings } from '@/services/settings';
import { redis, CACHE_TTL } from '@/lib/redis';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { getClientIp } from '@/utils/request';

/** Parse a positive number from a settings string, or null. */
function parsePositive(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

    // Free-shipping threshold and fixed-cost overrides come from
    // admin → Налаштування доставки (no longer hardcoded). When the threshold
    // is unset, free shipping is disabled (freeFrom = null).
    const settings = (await getSettings()) as unknown as Record<string, string | undefined>;
    const freeFrom = parsePositive(settings.delivery_free_shipping_threshold);

    if (freeFrom !== null && total >= freeFrom) {
      return successResponse({ cost: 0, estimatedDays: '1-3 дні', freeFrom });
    }

    const fixedKey =
      method === 'ukrposhta' ? 'delivery_ukrposhta_fixed_cost' : 'delivery_nova_poshta_fixed_cost';
    const fixedCost = parsePositive(settings[fixedKey]);
    if (fixedCost !== null) {
      return successResponse({
        cost: fixedCost,
        estimatedDays: method === 'ukrposhta' ? '3-7 днів' : '1-3 дні',
        freeFrom,
      });
    }

    if (method === 'ukrposhta') {
      // Real estimate via the stateless /domestic/delivery-price endpoint.
      // weight comes in KG; Ukrposhta wants grams. The calc API needs both post
      // indexes: sender from settings, recipient from the picked office (passed
      // as `city` when it's a 5-digit index). Falls back to a tiered flat rate
      // when the API can't price it (no token / postcodes unknown).
      const senderPostcode = settings.delivery_ukrposhta_sender_postcode?.trim();
      const recipientPostcode = /^\d{5}$/.test(city ?? '') ? city : undefined;
      const apiCost = await estimateUkrposhtaCost({
        weight: Math.round(weight * 1000),
        declaredPrice: total,
        senderPostcode,
        recipientPostcode,
      });
      const cost = apiCost ?? (weight <= 2 ? 45 : weight <= 10 ? 65 : 95);
      return successResponse({ cost, estimatedDays: '3-7 днів', freeFrom });
    }

    // Nova Poshta estimation
    if (!city) {
      return successResponse({ cost: null, estimatedDays: null, freeFrom });
    }

    // Check Redis cache. Round weight/total to 1 decimal so floating-point
    // serialization differences (`1.1` vs `1.1000000000000001`) don't cause
    // cache misses for what is functionally the same query. Customers
    // adjusting cart by single units typically land on the same bucket.
    // Sender city comes from admin → Налаштування доставки
    // (delivery_nova_poshta_sender_city_ref), falling back to Kyiv. Включаємо
    // його в ключ кешу, щоб зміна міста-відправника не віддавала стару ціну.
    const citySender = await getNovaPoshtaSenderCityRef();
    const wKey = (Math.round(weight * 10) / 10).toFixed(1);
    const tKey = (Math.round(total * 100) / 100).toFixed(2);
    const cacheKey = `delivery:estimate:${citySender}:${method}:${city}:${wKey}:${tKey}`;
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return successResponse({ ...JSON.parse(cached), freeFrom });
    }

    const estimate = await estimateDeliveryCost({
      citySender,
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
