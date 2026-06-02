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
vi.mock('@/services/payment-providers/monobank', () => ({ verifyCallback: vi.fn() }));
vi.mock('@/services/payment', () => ({ handlePaymentCallback: vi.fn() }));

import { POST } from './route';
import { verifyCallback } from '@/services/payment-providers/monobank';
import { handlePaymentCallback } from '@/services/payment';

describe('POST /api/webhooks/monobank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('returns 401 on signature mismatch (loud, so forgeries are detectable)', async () => {
    // Was 200-on-everything; signature failures are now surfaced as 401 (see
    // liqpay route for rationale). Monobank retries, but the forged payload
    // re-fails each time; the IP rate-limit caps retry storms.
    vi.mocked(verifyCallback).mockRejectedValue(new Error('Invalid signature'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'bad-body',
      headers: { 'X-Sign': 'bad-sig' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 500 on a non-signature processing error', async () => {
    vi.mocked(verifyCallback).mockResolvedValue({ orderId: '1', status: 'success' } as any);
    vi.mocked(handlePaymentCallback).mockRejectedValue(new Error('db down'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: '{"invoiceId":"test"}',
      headers: { 'X-Sign': 'sig', 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
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
