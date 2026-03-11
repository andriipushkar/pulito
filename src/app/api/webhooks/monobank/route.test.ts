import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/payment-providers/monobank', () => ({ verifyCallback: vi.fn() }));
vi.mock('@/services/payment', () => ({ handlePaymentCallback: vi.fn() }));

import { POST } from './route';
import { verifyCallback } from '@/services/payment-providers/monobank';
import { handlePaymentCallback } from '@/services/payment';

describe('POST /api/webhooks/monobank', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('processes callback on success', async () => {
    vi.mocked(verifyCallback).mockResolvedValue({ orderId: '1', status: 'success' } as any);
    vi.mocked(handlePaymentCallback).mockResolvedValue(undefined);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '{"invoiceId":"test"}',
      headers: { 'X-Sign': 'test-signature', 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 200 on error to prevent retries', async () => {
    vi.mocked(verifyCallback).mockRejectedValue(new Error('invalid'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'bad-body',
      headers: { 'X-Sign': 'bad-sig' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when body is empty', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '',
      headers: { 'X-Sign': 'some-sig' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when X-Sign header is missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '{"invoiceId":"test"}',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
