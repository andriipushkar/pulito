import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('@/config/env', () => ({
  env: {
    WAYFORPAY_MERCHANT_ACCOUNT: 'test_merchant',
    WAYFORPAY_SECRET_KEY: 'test_secret_key',
    APP_URL: 'https://test.com',
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createHmacSignature(data: string[], secretKey: string = 'test_secret_key'): string {
  const signString = data.join(';');
  return crypto.createHmac('md5', secretKey).update(signString).digest('hex');
}

describe('WayForPay provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create payment via API', async () => {
    const { createPayment } = await import('./wayforpay');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reasonCode: 1100,
        invoiceUrl: 'https://secure.wayforpay.com/invoice/test123',
      }),
    });

    const result = await createPayment(
      1, 500, 'Test order', 'http://localhost/result', 'http://localhost/webhook'
    );

    expect(result.redirectUrl).toBe('https://secure.wayforpay.com/invoice/test123');
    expect(result.paymentId).toMatch(/^order_1_\d+$/);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.wayforpay.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );

    // Verify request body
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.transactionType).toBe('CREATE_INVOICE');
    expect(callBody.merchantAccount).toBe('test_merchant');
    expect(callBody.amount).toBe(500);
    expect(callBody.currency).toBe('UAH');
    expect(callBody.language).toBe('UA');
    expect(callBody.returnUrl).toBe('http://localhost/result');
    expect(callBody.serviceUrl).toBe('http://localhost/webhook');
    expect(callBody.merchantSignature).toBeTruthy();
  });

  it('should throw on missing credentials', async () => {
    const envMod = await import('@/config/env');
    const origAccount = envMod.env.WAYFORPAY_MERCHANT_ACCOUNT;
    const origKey = envMod.env.WAYFORPAY_SECRET_KEY;
    (envMod.env as Record<string, string>).WAYFORPAY_MERCHANT_ACCOUNT = '';
    (envMod.env as Record<string, string>).WAYFORPAY_SECRET_KEY = '';

    try {
      const { createPayment, WayForPayError } = await import('./wayforpay');
      await expect(
        createPayment(1, 100, 'test', 'http://r', 'http://s')
      ).rejects.toThrow(WayForPayError);
      await expect(
        createPayment(1, 100, 'test', 'http://r', 'http://s')
      ).rejects.toThrow('WayForPay credentials not configured');
    } finally {
      (envMod.env as Record<string, string>).WAYFORPAY_MERCHANT_ACCOUNT = origAccount;
      (envMod.env as Record<string, string>).WAYFORPAY_SECRET_KEY = origKey;
    }
  });

  it('should throw on API HTTP error', async () => {
    const { createPayment, WayForPayError } = await import('./wayforpay');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost')
    ).rejects.toThrow(WayForPayError);
  });

  it('should throw with reason on API error with non-1100 reasonCode', async () => {
    const { createPayment } = await import('./wayforpay');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reasonCode: 1112,
        reason: 'Invalid merchant',
      }),
    });

    await expect(
      createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost')
    ).rejects.toThrow('Invalid merchant');
  });

  it('should include reasonCode in error when reason is missing', async () => {
    const { createPayment } = await import('./wayforpay');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reasonCode: 4100,
      }),
    });

    await expect(
      createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost')
    ).rejects.toThrow('WayForPay error: 4100');
  });

  it('should handle text() failure on error response', async () => {
    const { createPayment } = await import('./wayforpay');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => { throw new Error('parse error'); },
    });

    try {
      await createPayment(1, 100, 'Test', 'http://localhost', 'http://localhost');
    } catch (e) {
      expect((e as { statusCode: number }).statusCode).toBe(502);
    }
  });

  describe('WayForPayError', () => {
    it('should create error with default status code', async () => {
      const { WayForPayError } = await import('./wayforpay');
      const err = new WayForPayError('test');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('WayForPayError');
      expect(err).toBeInstanceOf(Error);
    });

    it('should create error with custom status code', async () => {
      const { WayForPayError } = await import('./wayforpay');
      const err = new WayForPayError('test', 502);
      expect(err.statusCode).toBe(502);
    });
  });

  describe('verifyCallback', () => {
    it('should verify valid callback with Approved status', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_42_1700000000',
        amount: 250.50,
        currency: 'UAH',
        authCode: '123456',
        cardPan: '****1234',
        transactionStatus: 'Approved',
        reasonCode: 1100,
        transactionId: 98765,
        merchantSignature: '',
      };

      // Compute expected signature
      const signatureData = [
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ];
      callbackData.merchantSignature = createHmacSignature(signatureData);

      const result = verifyCallback(callbackData);
      expect(result.orderId).toBe(42);
      expect(result.status).toBe('success');
      expect(result.transactionId).toBe('98765');
    });

    it('should map Declined status to failure', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_10_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Declined',
        reasonCode: 1112,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      const result = verifyCallback(callbackData);
      expect(result.status).toBe('failure');
    });

    it('should map Refunded status to failure', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_11_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Refunded',
        reasonCode: 1100,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      const result = verifyCallback(callbackData);
      expect(result.status).toBe('failure');
    });

    it('should map Voided status to failure', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_12_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Voided',
        reasonCode: 1100,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      const result = verifyCallback(callbackData);
      expect(result.status).toBe('failure');
    });

    it('should map Expired status to failure', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_13_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Expired',
        reasonCode: 1100,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      const result = verifyCallback(callbackData);
      expect(result.status).toBe('failure');
    });

    it('should return processing for unknown status', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_14_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'InProcessing',
        reasonCode: 1100,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      const result = verifyCallback(callbackData);
      expect(result.status).toBe('processing');
    });

    it('should reject invalid signature', async () => {
      const { verifyCallback, WayForPayError } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_1_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Approved',
        reasonCode: 1100,
        merchantSignature: 'invalid-signature',
      };

      expect(() => verifyCallback(callbackData)).toThrow(WayForPayError);
      expect(() => verifyCallback(callbackData)).toThrow('Invalid WayForPay signature');
    });

    it('should throw for invalid orderReference format', async () => {
      const { verifyCallback, WayForPayError } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'invalid_reference',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Approved',
        reasonCode: 1100,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      expect(() => verifyCallback(callbackData)).toThrow(WayForPayError);
      expect(() => verifyCallback(callbackData)).toThrow('Invalid orderReference in callback');
    });

    it('should use orderReference as transactionId when transactionId is absent', async () => {
      const { verifyCallback } = await import('./wayforpay');

      const callbackData = {
        merchantAccount: 'test_merchant',
        orderReference: 'order_20_1700000000',
        amount: 100,
        currency: 'UAH',
        authCode: '',
        cardPan: '',
        transactionStatus: 'Approved',
        reasonCode: 1100,
        merchantSignature: '',
      };

      callbackData.merchantSignature = createHmacSignature([
        callbackData.merchantAccount,
        callbackData.orderReference,
        String(callbackData.amount),
        callbackData.currency,
        callbackData.authCode,
        callbackData.cardPan,
        callbackData.transactionStatus,
        String(callbackData.reasonCode),
      ]);

      const result = verifyCallback(callbackData);
      expect(result.transactionId).toBe('order_20_1700000000');
    });

    it('should throw when secret key is not configured', async () => {
      const envMod = await import('@/config/env');
      const origKey = envMod.env.WAYFORPAY_SECRET_KEY;
      (envMod.env as Record<string, string>).WAYFORPAY_SECRET_KEY = '';

      try {
        const { verifyCallback, WayForPayError } = await import('./wayforpay');

        const callbackData = {
          merchantAccount: 'test_merchant',
          orderReference: 'order_1_1700000000',
          amount: 100,
          currency: 'UAH',
          transactionStatus: 'Approved',
          reasonCode: 1100,
          merchantSignature: 'sig',
        };

        expect(() => verifyCallback(callbackData as any)).toThrow(WayForPayError);
        expect(() => verifyCallback(callbackData as any)).toThrow('WayForPay secret key not configured');
      } finally {
        (envMod.env as Record<string, string>).WAYFORPAY_SECRET_KEY = origKey;
      }
    });
  });

  describe('createCallbackResponse', () => {
    it('should generate correct response format with accept status', async () => {
      const { createCallbackResponse } = await import('./wayforpay');

      const response = createCallbackResponse('order_1_1700000000');
      const parsed = JSON.parse(response);

      expect(parsed.orderReference).toBe('order_1_1700000000');
      expect(parsed.status).toBe('accept');
      expect(parsed.time).toBeTypeOf('number');
      expect(parsed.signature).toBeTruthy();

      // Verify the signature is correct
      const expectedSignature = createHmacSignature([
        'order_1_1700000000',
        'accept',
        String(parsed.time),
      ]);
      expect(parsed.signature).toBe(expectedSignature);
    });

    it('should generate correct response format with refuse status', async () => {
      const { createCallbackResponse } = await import('./wayforpay');

      const response = createCallbackResponse('order_2_1700000000', 'refuse');
      const parsed = JSON.parse(response);

      expect(parsed.orderReference).toBe('order_2_1700000000');
      expect(parsed.status).toBe('refuse');
      expect(parsed.time).toBeTypeOf('number');
      expect(parsed.signature).toBeTruthy();
    });
  });
});
