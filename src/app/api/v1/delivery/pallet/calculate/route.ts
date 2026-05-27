import { NextRequest } from 'next/server';
import { calculatePalletDeliveryCost, PalletDeliveryError } from '@/services/pallet-delivery';
import { calculatePalletCostSchema } from '@/validators/pallet-delivery';
import { successResponse, errorResponse } from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Public pricing calculator — used by the checkout widget. Reuse the
    // `publicDelivery` bucket so it shares the same 30/min cap as the
    // delivery-cities autocomplete; that's plenty for legit checkout flows
    // and stops a competitor from enumerating tariff bands at full throttle.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicDelivery);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }

    const body = await request.json();
    const parsed = calculatePalletCostSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 400);
    }

    const result = await calculatePalletDeliveryCost(parsed.data.weightKg, parsed.data.region);
    const res = successResponse(result);
    // Tariff inputs (weight, region) hash deterministically — same answer
    // for 60s lets the CDN absorb most lookups without re-hitting the app.
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res;
  } catch (error) {
    if (error instanceof PalletDeliveryError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка розрахунку вартості доставки', 500);
  }
}
