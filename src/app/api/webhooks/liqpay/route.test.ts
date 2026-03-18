import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/payment-providers/liqpay', () => ({ verifyCallback: vi.fn() }));
vi.mock('@/services/payment', () => ({ handlePaymentCallback: vi.fn() }));

import { POST } from './route';
import { verifyCallback } from '@/services/payment-providers/liqpay';
import { handlePaymentCallback } from '@/services/payment';

describe('POST /api/webhooks/liqpay', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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

  it('returns 200 on error to prevent retries', async () => {
    vi.mocked(verifyCallback).mockImplementation(() => { throw new Error('invalid'); });
    const formData = new FormData();
    formData.append('data', 'bad-data');
    formData.append('signature', 'bad-sig');
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
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
