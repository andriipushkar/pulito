import { describe, it, expect, vi } from 'vitest';
import { QRCodeError, generateQRCode, generateOrderQR, generatePaymentQR } from './qr-code';

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://test.com' },
}));

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-qr')),
  },
}));

import QRCode from 'qrcode';

describe('QRCodeError', () => {
  it('should have correct name and default statusCode', () => {
    const err = new QRCodeError('test');
    expect(err.name).toBe('QRCodeError');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('test');
  });
});

describe('generateQRCode', () => {
  it('should return a buffer', async () => {
    const result = await generateQRCode('hello');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(QRCode.toBuffer).toHaveBeenCalledWith('hello', expect.objectContaining({ type: 'png' }));
  });

  it('should throw QRCodeError on failure', async () => {
    vi.mocked(QRCode.toBuffer).mockRejectedValueOnce(new Error('fail'));
    await expect(generateQRCode('bad')).rejects.toThrow(QRCodeError);
  });
});

describe('generateOrderQR', () => {
  it('should encode order number in URL', async () => {
    await generateOrderQR('ORD-123');
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      'https://test.com/account/orders?search=ORD-123',
      expect.any(Object),
    );
  });
});

describe('generatePaymentQR', () => {
  it('should encode orderId and amount in URL', async () => {
    await generatePaymentQR(42, 1500);
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      'https://test.com/payment/42?amount=1500',
      expect.any(Object),
    );
  });
});
