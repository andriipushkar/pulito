import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';

export const POST = withRole('admin')(async (request: NextRequest) => {
  try {
    const { provider, config } = await request.json();

    if (provider === 'liqpay') {
      if (!config.publicKey || !config.privateKey) {
        return successResponse({ success: false, error: 'Public Key та Private Key обов\'язкові' });
      }
      // LiqPay test: create a test checkout request
      const crypto = await import('crypto');
      const testData = Buffer.from(JSON.stringify({
        version: 3,
        public_key: config.publicKey,
        action: 'status',
        order_id: 'test_connection_check',
      })).toString('base64');
      const signature = crypto.createHash('sha1')
        .update(config.privateKey + testData + config.privateKey)
        .digest('base64');

      const res = await fetch('https://www.liqpay.ua/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(testData)}&signature=${encodeURIComponent(signature)}`,
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.result === 'error' && data.err_code === 'order_not_found') {
        // This is actually a success — means credentials are valid
        return successResponse({ success: true, name: `LiqPay (${config.publicKey.slice(0, 10)}...)` });
      }
      if (data.result === 'error') {
        return successResponse({ success: false, error: data.err_description || data.err_code });
      }
      return successResponse({ success: true, name: 'LiqPay' });
    }

    if (provider === 'monobank') {
      if (!config.token) {
        return successResponse({ success: false, error: 'API Token обов\'язковий' });
      }
      const res = await fetch('https://api.monobank.ua/api/merchant/details', {
        headers: { 'X-Token': config.token },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        return successResponse({ success: true, name: `Monobank: ${data.merchantName || 'OK'}` });
      }
      return successResponse({ success: false, error: `HTTP ${res.status}: Невірний токен` });
    }

    if (provider === 'wayforpay') {
      if (!config.merchantAccount) {
        return successResponse({ success: false, error: 'Merchant Account обов\'язковий' });
      }
      // WayForPay doesn't have a simple test endpoint, just validate format
      if (config.merchantAccount.length < 3) {
        return successResponse({ success: false, error: 'Merchant Account занадто короткий' });
      }
      return successResponse({ success: true, name: `WayForPay: ${config.merchantAccount}` });
    }

    return successResponse({ success: false, error: 'Невідомий провайдер' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Помилка з\'єднання';
    return successResponse({ success: false, error: message });
  }
});
