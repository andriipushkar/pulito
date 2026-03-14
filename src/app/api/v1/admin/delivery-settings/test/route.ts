import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const { provider, config } = await request.json();

    if (provider === 'nova_poshta') {
      if (!config.apiKey) {
        return successResponse({ success: false, error: 'API Key обов\'язковий' });
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
      return successResponse({ success: false, error: data.errors?.join(', ') || 'Невірний API ключ' });
    }

    if (provider === 'ukrposhta') {
      if (!config.bearerToken) {
        return successResponse({ success: false, error: 'Bearer Token обов\'язковий' });
      }

      const res = await fetch('https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/last?barcode=0000000000000', {
        headers: {
          Authorization: `Bearer ${config.bearerToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      // 404 with valid token = token works, barcode doesn't exist
      // 401 = invalid token
      if (res.status === 401) {
        return successResponse({ success: false, error: 'Невірний Bearer Token' });
      }
      return successResponse({ success: true, name: 'Укрпошта: токен валідний' });
    }

    return successResponse({ success: false, error: 'Невідомий провайдер' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Помилка з\'єднання';
    return successResponse({ success: false, error: message });
  }
});
