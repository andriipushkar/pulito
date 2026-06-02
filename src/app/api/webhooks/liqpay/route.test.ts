import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
  },
}));
vi.mock('@/services/payment-providers/liqpay', () => ({ verifyCallback: vi.fn() }));
vi.mock('@/services/payment', () => ({ handlePaymentCallback: vi.fn() }));
vi.mock('@/utils/webhook-security', () => ({
  checkWebhookRateLimit: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/services/webhook-log', () => ({ logWebhook: vi.fn().mockResolvedValue(undefined) }));

import { POST } from './route';
import { verifyCallback } from '@/services/payment-providers/liqpay';
import { handlePaymentCallback } from '@/services/payment';

describe('POST /api/webhooks/liqpay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes callback on success', async () => {
    vi.mocked(verifyCallback).mockReturnValue({ orderId: '1', status: 'success' } as any);
    vi.mocked(handlePaymentCallback).mockResolvedValue(undefined);
    const formData = new FormData();
    formData.append('data', 'test-data');
    formData.append('signature', 'test-signature');
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 401 on signature mismatch (loud, so forgeries are detectable)', async () => {
    // Was 200-on-everything to "prevent retries"; now a signature failure is
    // surfaced as 401 so monitoring sees it and a forger can't tell a
    // successful forgery from a rejection. LiqPay still retries, but the same
    // forged payload re-fails each time (IP rate-limit caps retry storms).
    vi.mocked(verifyCallback).mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const formData = new FormData();
    formData.append('data', 'bad-data');
    formData.append('signature', 'bad-sig');
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 500 on a non-signature processing error', async () => {
    vi.mocked(verifyCallback).mockReturnValue({ orderId: '1', status: 'success' } as any);
    vi.mocked(handlePaymentCallback).mockRejectedValue(new Error('db down'));
    const formData = new FormData();
    formData.append('data', 'd');
    formData.append('signature', 's');
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 when data is missing', async () => {
    const formData = new FormData();
    formData.append('signature', 'sig-only');
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature is missing', async () => {
    const formData = new FormData();
    formData.append('data', 'data-only');
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
