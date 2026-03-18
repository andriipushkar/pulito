import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/payment-providers/wayforpay', () => ({
  verifyCallback: vi.fn(),
  createCallbackResponse: vi.fn(),
}));
vi.mock('@/services/payment', () => ({ handlePaymentCallback: vi.fn() }));

import { POST } from './route';
import { verifyCallback, createCallbackResponse } from '@/services/payment-providers/wayforpay';
import { handlePaymentCallback } from '@/services/payment';

describe('POST /api/webhooks/wayforpay', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('processes callback on success', async () => {
    vi.mocked(verifyCallback).mockReturnValue({ orderId: 1, status: 'success' } as any);
    vi.mocked(handlePaymentCallback).mockResolvedValue(undefined);
    vi.mocked(createCallbackResponse).mockReturnValue('{"orderReference":"order_1_123","status":"accept","time":123,"signature":"sig"}');

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        merchantAccount: 'test',
        orderReference: 'order_1_123',
        merchantSignature: 'valid-sig',
        transactionStatus: 'Approved',
        amount: 100,
        currency: 'UAH',
        reasonCode: 1100,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('accept');
    expect(verifyCallback).toHaveBeenCalled();
    expect(handlePaymentCallback).toHaveBeenCalledWith('wayforpay', expect.any(Object));
    expect(createCallbackResponse).toHaveBeenCalledWith('order_1_123', 'accept');
  });

  it('returns 400 when merchantSignature is missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        merchantAccount: 'test',
        orderReference: 'order_1_123',
        transactionStatus: 'Approved',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 on error to prevent retries', async () => {
    vi.mocked(verifyCallback).mockImplementation(() => { throw new Error('invalid signature'); });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        merchantAccount: 'test',
        orderReference: 'order_1_123',
        merchantSignature: 'bad-sig',
        transactionStatus: 'Approved',
        amount: 100,
        currency: 'UAH',
        reasonCode: 1100,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('accept');
  });
});
