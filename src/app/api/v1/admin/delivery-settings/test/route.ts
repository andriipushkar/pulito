import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';

// Mirror the smtp/payment test rate limit so a curious admin or a stolen
// token can't brute-force test millions of API keys via this endpoint.
const RATE_BUCKET = new Map<number, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
function isRateLimited(adminId: number): boolean {
  const now = Date.now();
  const hits = (RATE_BUCKET.get(adminId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  RATE_BUCKET.set(adminId, hits);
  return hits.length > RATE_MAX;
}

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    if (isRateLimited(user.id)) {
      return errorResponse('Забагато тестових запитів. Зачекайте хвилину.', 429);
    }
    const { provider, config } = await request.json();

    if (provider === 'nova_poshta') {
      if (!config.apiKey) {
        return successResponse({ success: false, error: "API Key обов'язковий" });
      }

      const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.apiKey,
          modelName: 'Address',
          calledMethod: 'searchSettlements',
          methodProperties: { CityName: 'Київ', Limit: '1' },
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (data.success) {
        return successResponse({ success: true, name: 'Нова Пошта: API ключ валідний' });
      }
      return successResponse({
        success: false,
        error: data.errors?.join(', ') || 'Невірний API ключ',
      });
    }

    if (provider === 'ukrposhta') {
      if (!config.bearerToken) {
        return successResponse({ success: false, error: "Bearer Token обов'язковий" });
      }

      const res = await fetch(
        'https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/last?barcode=0000000000000',
        {
          headers: {
            Authorization: `Bearer ${config.bearerToken}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      // 404 with valid token = token works, barcode doesn't exist
      // 401 = invalid token
      if (res.status === 401) {
        return successResponse({ success: false, error: 'Невірний Bearer Token' });
      }
      return successResponse({ success: true, name: 'Укрпошта: токен валідний' });
    }

    return successResponse({ success: false, error: 'Невідомий провайдер' });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Помилка з'єднання";
    return successResponse({ success: false, error: message });
  }
});
