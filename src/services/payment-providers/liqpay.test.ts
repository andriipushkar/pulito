import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('@/config/env', () => ({
  env: {
    LIQPAY_PUBLIC_KEY: 'sandbox_public',
    LIQPAY_PRIVATE_KEY: 'sandbox_private',
  },
}));

const liqpayCreds: {
  publicKey: string;
  privateKey: string;
  sandbox?: boolean;
  paypartCount?: number;
} = { publicKey: 'sandbox_public', privateKey: 'sandbox_private', sandbox: false, paypartCount: 3 };
vi.mock('@/services/integration-credentials', () => ({
  getLiqPayCreds: vi.fn(async () => liqpayCreds),
}));

describe('LiqPay provider', () => {
  it('should create payment URL', async () => {
    const { createPayment } = await import('./liqpay');
    const result = await createPayment(
      1,
      250.5,
      'Test order',
      'http://localhost/result',
      'http://localhost/callback',
    );
    expect(result.redirectUrl).toContain('https://www.liqpay.ua/api/3/checkout');
    expect(result.redirectUrl).toContain('data=');
    expect(result.redirectUrl).toContain('signature=');
  });

  it('should verify valid callback signature', async () => {
    const { verifyCallback } = await import('./liqpay');

    const payload = {
      action: 'pay',
      status: 'success',
      order_id: 'order_42',
      payment_id: 12345,
      amount: 100,
      currency: 'UAH',
      description: 'Test',
      transaction_id: 67890,
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.orderId).toBe(42);
    expect(result.status).toBe('success');
    expect(result.transactionId).toBe('67890');
  });

  it('should reject invalid signature', async () => {
    const { verifyCallback, LiqPayError } = await import('./liqpay');
    const data = Buffer.from(JSON.stringify({ order_id: 'order_1' })).toString('base64');

    await expect(verifyCallback(data, 'invalid-signature')).rejects.toThrow(LiqPayError);
  });

  it('should handle sandbox status as success', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_10', status: 'sandbox', payment_id: 111 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.status).toBe('success');
  });

  it('should handle failure status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_11', status: 'failure', payment_id: 222 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.status).toBe('failure');
  });

  it('should handle error status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_12', status: 'error', payment_id: 333 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.status).toBe('failure');
  });

  it('should handle reversed status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_13', status: 'reversed', payment_id: 444 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.status).toBe('failure');
  });

  it('should handle processing status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_14', status: 'processing', payment_id: 555 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.status).toBe('processing');
  });

  it('should throw for invalid order_id format', async () => {
    const { verifyCallback, LiqPayError } = await import('./liqpay');
    const payload = { order_id: 'order_invalid', status: 'success', payment_id: 999 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    await expect(verifyCallback(data, signature)).rejects.toThrow(LiqPayError);
    await expect(verifyCallback(data, signature)).rejects.toThrow('Invalid order_id in callback');
  });

  it('should use transaction_id when available', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = {
      order_id: 'order_15',
      status: 'success',
      transaction_id: 777,
      payment_id: 888,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.transactionId).toBe('777');
  });

  it('should handle missing keys', async () => {
    const origPub = liqpayCreds.publicKey;
    const origPriv = liqpayCreds.privateKey;
    liqpayCreds.publicKey = '';
    liqpayCreds.privateKey = '';
    try {
      const { createPayment, LiqPayError } = await import('./liqpay');
      await expect(createPayment(1, 100, 'test', 'http://r', 'http://s')).rejects.toThrow(
        LiqPayError,
      );
    } finally {
      liqpayCreds.publicKey = origPub;
      liqpayCreds.privateKey = origPriv;
    }
  });

  it('LiqPayError should default to 400 status', async () => {
    const { LiqPayError } = await import('./liqpay');
    const err = new LiqPayError('test');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('LiqPayError');
    expect(err).toBeInstanceOf(Error);
  });

  it('createApplePayPayment encodes paytypes=apay', async () => {
    const { createApplePayPayment } = await import('./liqpay');
    const r = await createApplePayPayment(7, 100, 'order', 'http://r', 'http://s');
    const url = new URL(r.redirectUrl);
    const data = JSON.parse(
      Buffer.from(decodeURIComponent(url.searchParams.get('data')!), 'base64').toString(),
    );
    expect(data.paytypes).toBe('apay');
    expect(data.action).toBe('pay');
  });

  it('createGooglePayPayment encodes paytypes=gpay', async () => {
    const { createGooglePayPayment } = await import('./liqpay');
    const r = await createGooglePayPayment(8, 100, 'order', 'http://r', 'http://s');
    const url = new URL(r.redirectUrl);
    const data = JSON.parse(
      Buffer.from(decodeURIComponent(url.searchParams.get('data')!), 'base64').toString(),
    );
    expect(data.paytypes).toBe('gpay');
  });

  it('createPaypartPayment encodes paytypes=paypart with instalment_count', async () => {
    const orig = liqpayCreds.paypartCount;
    liqpayCreds.paypartCount = 6;
    try {
      const { createPaypartPayment } = await import('./liqpay');
      const r = await createPaypartPayment(9, 100, 'order', 'http://r', 'http://s');
      const url = new URL(r.redirectUrl);
      const data = JSON.parse(
        Buffer.from(decodeURIComponent(url.searchParams.get('data')!), 'base64').toString(),
      );
      expect(data.paytypes).toBe('paypart');
      expect(data.instalment_count).toBe(6);
    } finally {
      liqpayCreds.paypartCount = orig;
    }
  });

  it('createPayment respects sandbox flag', async () => {
    liqpayCreds.sandbox = true;
    try {
      const { createPayment } = await import('./liqpay');
      const r = await createPayment(10, 50, 'sandbox order', 'http://r', 'http://s');
      const url = new URL(r.redirectUrl);
      const data = JSON.parse(
        Buffer.from(decodeURIComponent(url.searchParams.get('data')!), 'base64').toString(),
      );
      expect(data.sandbox).toBe(1);
    } finally {
      liqpayCreds.sandbox = false;
    }
  });

  it('checkPaymentStatus parses success', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', amount: 100 }),
    } as Response);
    const { checkPaymentStatus } = await import('./liqpay');
    const r = await checkPaymentStatus(1);
    expect(r.status).toBe('success');
    expect(r.amount).toBe(100);
    fetchSpy.mockRestore();
  });

  it('checkPaymentStatus parses failure', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'failure' }),
    } as Response);
    const { checkPaymentStatus } = await import('./liqpay');
    const r = await checkPaymentStatus(1);
    expect(r.status).toBe('failure');
    fetchSpy.mockRestore();
  });

  it('should return empty string for transactionId when both transaction_id and payment_id are absent', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_20', status: 'success' };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = await verifyCallback(data, signature);
    expect(result.transactionId).toBe('');
    expect(result.orderId).toBe(20);
    expect(result.status).toBe('success');
  });
});
