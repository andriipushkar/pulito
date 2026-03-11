import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('@/config/env', () => ({
  env: {
    LIQPAY_PUBLIC_KEY: 'sandbox_public',
    LIQPAY_PRIVATE_KEY: 'sandbox_private',
  },
}));

describe('LiqPay provider', () => {
  it('should create payment URL', async () => {
    const { createPayment } = await import('./liqpay');
    const result = await createPayment(
      1, 250.50, 'Test order', 'http://localhost/result', 'http://localhost/callback'
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

    const result = verifyCallback(data, signature);
    expect(result.orderId).toBe(42);
    expect(result.status).toBe('success');
    expect(result.transactionId).toBe('67890');
  });

  it('should reject invalid signature', async () => {
    const { verifyCallback, LiqPayError } = await import('./liqpay');
    const data = Buffer.from(JSON.stringify({ order_id: 'order_1' })).toString('base64');

    expect(() => verifyCallback(data, 'invalid-signature')).toThrow(LiqPayError);
  });

  it('should handle sandbox status as success', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_10', status: 'sandbox', payment_id: 111 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.status).toBe('success');
  });

  it('should handle failure status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_11', status: 'failure', payment_id: 222 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.status).toBe('failure');
  });

  it('should handle error status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_12', status: 'error', payment_id: 333 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.status).toBe('failure');
  });

  it('should handle reversed status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_13', status: 'reversed', payment_id: 444 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.status).toBe('failure');
  });

  it('should handle processing status', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_14', status: 'processing', payment_id: 555 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.status).toBe('processing');
  });

  it('should throw for invalid order_id format', async () => {
    const { verifyCallback, LiqPayError } = await import('./liqpay');
    const payload = { order_id: 'order_invalid', status: 'success', payment_id: 999 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    expect(() => verifyCallback(data, signature)).toThrow(LiqPayError);
    expect(() => verifyCallback(data, signature)).toThrow('Invalid order_id in callback');
  });

  it('should use transaction_id when available', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_15', status: 'success', transaction_id: 777, payment_id: 888 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.transactionId).toBe('777');
  });

  it('should handle missing keys', async () => {
    const envMod = await import('@/config/env');
    const origPublic = envMod.env.LIQPAY_PUBLIC_KEY;
    const origPrivate = envMod.env.LIQPAY_PRIVATE_KEY;
    (envMod.env as Record<string, string>).LIQPAY_PUBLIC_KEY = '';
    (envMod.env as Record<string, string>).LIQPAY_PRIVATE_KEY = '';

    try {
      const { createPayment, LiqPayError } = await import('./liqpay');
      await expect(createPayment(1, 100, 'test', 'http://r', 'http://s')).rejects.toThrow(LiqPayError);
    } finally {
      (envMod.env as Record<string, string>).LIQPAY_PUBLIC_KEY = origPublic;
      (envMod.env as Record<string, string>).LIQPAY_PRIVATE_KEY = origPrivate;
    }
  });

  it('LiqPayError should default to 400 status', async () => {
    const { LiqPayError } = await import('./liqpay');
    const err = new LiqPayError('test');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('LiqPayError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should return empty string for transactionId when both transaction_id and payment_id are absent', async () => {
    const { verifyCallback } = await import('./liqpay');
    const payload = { order_id: 'order_20', status: 'success' };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signString = 'sandbox_private' + data + 'sandbox_private';
    const signature = crypto.createHash('sha1').update(signString).digest('base64');

    const result = verifyCallback(data, signature);
    expect(result.transactionId).toBe('');
    expect(result.orderId).toBe(20);
    expect(result.status).toBe('success');
  });
});
