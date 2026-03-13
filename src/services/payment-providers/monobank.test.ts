import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: { MONOBANK_TOKEN: 'test-mono-token' },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Monobank provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create invoice', async () => {
    const { createPayment } = await import('./monobank');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        invoiceId: 'inv_123',
        pageUrl: 'https://pay.monobank.ua/inv_123',
      }),
    });

    const result = await createPayment(
      1, 500, 'Test', 'http://localhost/result', 'http://localhost/webhook'
    );

    expect(result.redirectUrl).toBe('https://pay.monobank.ua/inv_123');
    expect(result.paymentId).toBe('inv_123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.monobank.ua/api/merchant/invoice/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Token': 'test-mono-token' }),
      })
    );

    // Verify amount is in kopecks
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.amount).toBe(50000);
    expect(callBody.ccy).toBe(980);
  });

  it('should throw on API error', async () => {
    const { createPayment, MonobankError } = await import('./monobank');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ errText: 'Bad request' }),
    });

    await expect(
      createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost')
    ).rejects.toThrow(MonobankError);
  });

  it('should throw with errText in message', async () => {
    const { createPayment } = await import('./monobank');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ errText: 'Bad request' }),
    });

    await expect(
      createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost')
    ).rejects.toThrow('Bad request');
  });

  it('should handle json parse failure on error response', async () => {
    const { createPayment } = await import('./monobank');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('invalid json'); },
    });

    try {
      await createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost');
    } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(502);
    }
  });

  it('should throw when token not configured', async () => {
    const { env } = await import('@/config/env');
    const original = env.MONOBANK_TOKEN;
    (env as unknown as Record<string, string>).MONOBANK_TOKEN = '';

    const { createPayment } = await import('./monobank');
    await expect(
      createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost')
    ).rejects.toThrow('Monobank token not configured');

    (env as unknown as Record<string, string>).MONOBANK_TOKEN = original;
  });

  describe('MonobankError', () => {
    it('should create error with default status code', async () => {
      const { MonobankError } = await import('./monobank');
      const err = new MonobankError('test');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('MonobankError');
      expect(err).toBeInstanceOf(Error);
    });

    it('should create error with custom status code', async () => {
      const { MonobankError } = await import('./monobank');
      const err = new MonobankError('test', 502);
      expect(err.statusCode).toBe(502);
    });
  });

  describe('verifyCallback', () => {
    it('should throw when pubkey fetch fails', async () => {
      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(freshMod.verifyCallback('{}', 'sig')).rejects.toThrow(
        'Failed to get Monobank public key'
      );
    });

    it('should throw on invalid signature', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync } = crypto;
      const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body = JSON.stringify({ reference: 'order_123', status: 'success', invoiceId: 'inv_1' });
      const wrongSignature = Buffer.from('invalid').toString('base64');

      await expect(freshMod.verifyCallback(body, wrongSignature)).rejects.toThrow('Invalid Monobank signature');
    });

    it('should parse valid callback with success status', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync, sign } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body = JSON.stringify({ reference: 'order_42', status: 'success', invoiceId: 'inv_99' });
      const signature = sign('SHA256', Buffer.from(body), privateKey).toString('base64');

      const result = await freshMod.verifyCallback(body, signature);

      expect(result.orderId).toBe(42);
      expect(result.status).toBe('success');
      expect(result.transactionId).toBe('inv_99');
    });

    it('should return failure status for failure', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync, sign } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body = JSON.stringify({ reference: 'order_10', status: 'failure', invoiceId: 'inv_10' });
      const signature = sign('SHA256', Buffer.from(body), privateKey).toString('base64');

      const result = await freshMod.verifyCallback(body, signature);
      expect(result.status).toBe('failure');
    });

    it('should return processing status for other statuses', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync, sign } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body = JSON.stringify({ reference: 'order_10', status: 'processing', invoiceId: 'inv_10' });
      const signature = sign('SHA256', Buffer.from(body), privateKey).toString('base64');

      const result = await freshMod.verifyCallback(body, signature);
      expect(result.status).toBe('processing');
    });

    it('should return failure for reversed status', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync, sign } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body = JSON.stringify({ reference: 'order_10', status: 'reversed', invoiceId: 'inv_10' });
      const signature = sign('SHA256', Buffer.from(body), privateKey).toString('base64');

      const result = await freshMod.verifyCallback(body, signature);
      expect(result.status).toBe('failure');
    });

    it('should throw on invalid reference', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync, sign } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body = JSON.stringify({ reference: 'order_abc', status: 'success', invoiceId: 'inv_10' });
      const signature = sign('SHA256', Buffer.from(body), privateKey).toString('base64');

      await expect(freshMod.verifyCallback(body, signature)).rejects.toThrow(
        'Invalid reference in callback'
      );
    });

    it('should use cached pubkey on second call', async () => {
      const crypto = await import('crypto');
      const { generateKeyPairSync, sign } = crypto;
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const pubKeyBase64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).toString('base64');

      vi.resetModules();
      vi.mock('@/config/env', () => ({
        env: { MONOBANK_TOKEN: 'test-mono-token' },
      }));

      const freshMod = await import('./monobank');

      // First call fetches pubkey
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: pubKeyBase64 }),
      });

      const body1 = JSON.stringify({ reference: 'order_1', status: 'success', invoiceId: 'inv_1' });
      const sig1 = sign('SHA256', Buffer.from(body1), privateKey).toString('base64');
      await freshMod.verifyCallback(body1, sig1);

      // Second call should use cached key - no additional fetch mock needed
      const body2 = JSON.stringify({ reference: 'order_2', status: 'success', invoiceId: 'inv_2' });
      const sig2 = sign('SHA256', Buffer.from(body2), privateKey).toString('base64');
      const result = await freshMod.verifyCallback(body2, sig2);

      expect(result.orderId).toBe(2);
      // fetch was called only once for pubkey (plus any prior calls)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
