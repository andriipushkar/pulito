import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    loyaltyTransaction: {
      findFirst: vi.fn(),
    },
    // Advisory-lock helper queries; default to lock-acquired so refundPayment proceeds.
    $queryRaw: vi.fn().mockResolvedValue([{ ok: true }]),
    $transaction: vi.fn((input: unknown) => {
      // Support both array-style and callback-style transactions
      if (typeof input === 'function') {
        return (input as (tx: typeof prisma) => Promise<unknown>)(prisma as any);
      }
      return Promise.resolve(input);
    }),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://test.com' },
}));

vi.mock('./payment-providers/liqpay', () => ({
  createPayment: vi.fn(),
  createPaypartPayment: vi.fn(),
  createApplePayPayment: vi.fn(),
  createGooglePayPayment: vi.fn(),
  refundPayment: vi.fn(),
}));

vi.mock('./payment-providers/monobank', () => ({
  createPayment: vi.fn(),
  refundPayment: vi.fn(),
}));

vi.mock('./payment-providers/wayforpay', () => ({
  createPayment: vi.fn(),
  refundPayment: vi.fn(),
}));

const credsMock = vi.hoisted(() => ({
  liq: { publicKey: '', privateKey: '' },
  wfp: { merchantAccount: '', secretKey: '' },
}));

vi.mock('./integration-credentials', () => ({
  getLiqPayCreds: vi.fn(async () => credsMock.liq),
  getWayForPayCreds: vi.fn(async () => credsMock.wfp),
  getMonobankCreds: vi.fn(async () => ({ token: '' })),
  getNovaPoshtaCreds: vi.fn(async () => ({ apiKey: '' })),
  getUkrposhtaCreds: vi.fn(async () => ({ bearerToken: '' })),
}));

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import * as liqpay from './payment-providers/liqpay';
import * as monobank from './payment-providers/monobank';
import * as wayforpay from './payment-providers/wayforpay';
import {
  PaymentError,
  initiatePayment,
  handlePaymentCallback,
  getPaymentStatus,
  refundPayment,
} from './payment';

const mockPrisma = prisma as unknown as MockPrismaClient;
const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};
const mockLiqpay = liqpay as unknown as {
  createPayment: ReturnType<typeof vi.fn>;
  refundPayment: ReturnType<typeof vi.fn>;
};
const mockMonobank = monobank as unknown as {
  createPayment: ReturnType<typeof vi.fn>;
  refundPayment: ReturnType<typeof vi.fn>;
};
const mockWayforpay = wayforpay as unknown as {
  createPayment: ReturnType<typeof vi.fn>;
  refundPayment: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaymentError', () => {
  it('has correct name, message, and default statusCode', () => {
    const error = new PaymentError('test error');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PaymentError');
    expect(error.message).toBe('test error');
    expect(error.statusCode).toBe(400);
  });

  it('accepts a custom statusCode', () => {
    const error = new PaymentError('not found', 404);
    expect(error.name).toBe('PaymentError');
    expect(error.message).toBe('not found');
    expect(error.statusCode).toBe(404);
  });
});

describe('initiatePayment', () => {
  const baseOrder = {
    id: 1,
    orderNumber: 'ORD-001',
    totalAmount: 500,
    paymentMethod: 'online',
    paymentStatus: 'pending',
    payment: null,
  };

  it('throws 404 if order not found', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(initiatePayment(999, 'liqpay')).rejects.toThrow(PaymentError);
    await expect(initiatePayment(999, 'liqpay')).rejects.toMatchObject({
      message: 'Замовлення не знайдено',
      statusCode: 404,
    });
  });

  it('throws 400 if paymentMethod is not online', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...baseOrder,
      paymentMethod: 'cod',
    });

    await expect(initiatePayment(1, 'liqpay')).rejects.toThrow(PaymentError);
    await expect(initiatePayment(1, 'liqpay')).rejects.toMatchObject({
      message: 'Це замовлення не потребує онлайн-оплати',
      statusCode: 400,
    });
  });

  it('throws 400 if already paid', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...baseOrder,
      paymentStatus: 'paid',
    });

    await expect(initiatePayment(1, 'liqpay')).rejects.toThrow(PaymentError);
    await expect(initiatePayment(1, 'liqpay')).rejects.toMatchObject({
      message: 'Замовлення вже оплачено',
      statusCode: 400,
    });
  });

  it('calls liqpay.createPayment when provider is liqpay and upserts payment record', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseOrder);
    const paymentResult = { paymentId: 'liq-123', paymentUrl: 'https://liqpay.ua/pay' };
    mockLiqpay.createPayment.mockResolvedValue(paymentResult);
    (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await initiatePayment(1, 'liqpay');

    expect(result).toEqual(paymentResult);
    expect(mockLiqpay.createPayment).toHaveBeenCalledWith(
      1,
      500,
      'Замовлення #ORD-001',
      'https://test.com/checkout/payment-redirect?orderId=1',
      'https://test.com/api/webhooks/liqpay',
    );
    expect(mockPrisma.payment.upsert).toHaveBeenCalledWith({
      where: { orderId: 1 },
      update: {
        paymentProvider: 'liqpay',
        transactionId: 'liq-123',
      },
      create: {
        orderId: 1,
        paymentMethod: 'online',
        paymentStatus: 'pending',
        amount: 500,
        paymentProvider: 'liqpay',
        transactionId: 'liq-123',
      },
    });
  });

  it('calls monobank.createPayment when provider is monobank', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseOrder);
    const paymentResult = { paymentId: 'mono-456', paymentUrl: 'https://pay.monobank.ua/pay' };
    mockMonobank.createPayment.mockResolvedValue(paymentResult);
    (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await initiatePayment(1, 'monobank');

    expect(result).toEqual(paymentResult);
    expect(mockMonobank.createPayment).toHaveBeenCalledWith(
      1,
      500,
      'Замовлення #ORD-001',
      'https://test.com/checkout/payment-redirect?orderId=1',
      'https://test.com/api/webhooks/monobank',
    );
    expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 1 },
        create: expect.objectContaining({
          paymentProvider: 'monobank',
          transactionId: 'mono-456',
        }),
      }),
    );
  });

  it('calls wayforpay.createPayment when provider is wayforpay', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseOrder);
    const paymentResult = {
      paymentId: 'order_1_1700000000',
      redirectUrl: 'https://secure.wayforpay.com/invoice/test',
    };
    mockWayforpay.createPayment.mockResolvedValue(paymentResult);
    (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await initiatePayment(1, 'wayforpay');

    expect(result).toEqual(paymentResult);
    expect(mockWayforpay.createPayment).toHaveBeenCalledWith(
      1,
      500,
      'Замовлення #ORD-001',
      'https://test.com/checkout/payment-redirect?orderId=1',
      'https://test.com/api/webhooks/wayforpay',
    );
    expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 1 },
        create: expect.objectContaining({
          paymentProvider: 'wayforpay',
          transactionId: 'order_1_1700000000',
        }),
      }),
    );
  });

  it('sets transactionId to null when paymentId is undefined', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseOrder);
    const paymentResult = { paymentUrl: 'https://liqpay.ua/pay' };
    mockLiqpay.createPayment.mockResolvedValue(paymentResult);
    (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await initiatePayment(1, 'liqpay');

    expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ transactionId: null }),
        create: expect.objectContaining({ transactionId: null }),
      }),
    );
  });
});

describe('handlePaymentCallback', () => {
  const successCallback = {
    orderId: 1,
    status: 'success' as const,
    transactionId: 'txn-001',
    rawData: { some: 'data' },
  };

  const failureCallback = {
    orderId: 1,
    status: 'failure' as const,
    transactionId: 'txn-002',
    rawData: { error: 'declined' },
  };

  it('creates payment record when none exists (success status)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 500,
    });
    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', successCallback);

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        amount: 500,
        paymentProvider: 'liqpay',
        transactionId: 'txn-001',
        callbackData: { some: 'data' },
        paidAt: expect.any(Date),
      }),
    });

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'paid',
        paymentStatus: 'paid',
        statusHistory: {
          create: {
            oldStatus: 'new_order',
            newStatus: 'paid',
            changeSource: 'system',
            comment: 'Оплата підтверджена через liqpay',
          },
        },
      },
    });
  });

  it('updates existing payment record (success status) and updates order', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 500,
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('monobank', successCallback);

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: {
        paymentStatus: 'paid',
        transactionId: 'txn-001',
        callbackData: { some: 'data' },
        paidAt: expect.any(Date),
        receiptUrl: undefined,
      },
    });

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        paymentStatus: 'paid',
      }),
    });
  });

  it('updates payment on failure status without updating order', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 500,
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', failureCallback);

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: {
        paymentStatus: 'pending',
        transactionId: 'txn-002',
        callbackData: { error: 'declined' },
        paidAt: null,
        receiptUrl: undefined,
      },
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('creates payment record on failure when none exists', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 300,
    });
    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('monobank', failureCallback);

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        paymentStatus: 'pending',
        amount: 300,
        paidAt: null,
      }),
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('creates payment record for wayforpay provider on success', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 750,
    });
    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('wayforpay', successCallback);

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        amount: 750,
        paymentProvider: 'wayforpay',
        transactionId: 'txn-001',
        callbackData: { some: 'data' },
        paidAt: expect.any(Date),
      }),
    });

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'paid',
        paymentStatus: 'paid',
        statusHistory: {
          create: {
            oldStatus: 'new_order',
            newStatus: 'paid',
            changeSource: 'system',
            comment: 'Оплата підтверджена через wayforpay',
          },
        },
      },
    });
  });

  it('updates existing payment for wayforpay on failure without updating order', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 500,
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('wayforpay', failureCallback);

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: {
        paymentStatus: 'pending',
        transactionId: 'txn-002',
        callbackData: { error: 'declined' },
        paidAt: null,
        receiptUrl: undefined,
      },
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('handles processing status with existing payment', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 500,
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', {
      orderId: 1,
      status: 'processing' as any,
      transactionId: 'txn-003',
      rawData: { status: 'processing' },
    });

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: {
        paymentStatus: 'pending',
        transactionId: 'txn-003',
        callbackData: { status: 'processing' },
        paidAt: null,
        receiptUrl: undefined,
      },
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });
});

describe('getPaymentStatus', () => {
  it('returns payment data', async () => {
    const paymentData = {
      paymentStatus: 'paid',
      paymentProvider: 'liqpay',
      transactionId: 'txn-001',
      amount: 500,
      paidAt: new Date('2026-01-15'),
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(paymentData);

    const result = await getPaymentStatus(1);

    expect(result).toEqual(paymentData);
    expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
      where: { orderId: 1 },
      select: {
        paymentStatus: true,
        paymentProvider: true,
        transactionId: true,
        amount: true,
        paidAt: true,
      },
    });
  });

  it('returns null when no payment exists', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getPaymentStatus(999);

    expect(result).toBeNull();
    expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
      where: { orderId: 999 },
      select: expect.any(Object),
    });
  });
});

describe('refundPayment', () => {
  const paidPayment = {
    paymentStatus: 'paid',
    paymentProvider: 'liqpay',
    transactionId: 'txn-001',
    amount: 500,
    // Refund accounting subtracts prior refunds from the paid total.
    refundedAmount: 0,
    order: { orderNumber: 'ORD-001', totalAmount: 500 },
  };

  it('throws 404 if payment not found', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(refundPayment(999)).rejects.toMatchObject({
      message: 'Платіж не знайдено',
      statusCode: 404,
    });
  });

  it('throws 400 if payment is not paid', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...paidPayment,
      paymentStatus: 'pending',
    });

    await expect(refundPayment(1)).rejects.toMatchObject({
      message: 'Повернення можливе тільки для оплачених замовлень',
      statusCode: 400,
    });
  });

  it('performs full refund via liqpay', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(paidPayment);
    mockLiqpay.refundPayment.mockResolvedValue({
      success: true,
      refundId: 'ref-001',
      status: 'refunded',
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await refundPayment(1);

    expect(result.success).toBe(true);
    expect(result.status).toBe('refunded');
    expect(mockLiqpay.refundPayment).toHaveBeenCalledWith(1, 500);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('performs partial refund via monobank', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...paidPayment,
      paymentProvider: 'monobank',
    });
    mockMonobank.refundPayment.mockResolvedValue({
      success: true,
      refundId: 'mono-ref',
      status: 'refunded',
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await refundPayment(1, 200);

    expect(result.success).toBe(true);
    expect(mockMonobank.refundPayment).toHaveBeenCalledWith('txn-001', 200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('performs refund via wayforpay', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...paidPayment,
      paymentProvider: 'wayforpay',
    });
    mockWayforpay.refundPayment.mockResolvedValue({
      success: true,
      refundId: 'wfp-ref',
      status: 'refunded',
    });
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await refundPayment(1);

    expect(result.success).toBe(true);
    expect(mockWayforpay.refundPayment).toHaveBeenCalledWith('txn-001', 500, 'txn-001');
  });

  it('does not update DB when provider refund fails', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(paidPayment);
    mockLiqpay.refundPayment.mockResolvedValue({
      success: false,
      status: 'failed',
      message: 'Insufficient funds',
    });

    const result = await refundPayment(1);

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('initiatePayment — apple_pay / google_pay routing', () => {
  const orderMock = {
    id: 1,
    orderNumber: 'ORD-1',
    totalAmount: 500,
    paymentMethod: 'online',
    paymentStatus: 'pending',
    payment: null,
  };

  beforeEach(() => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(orderMock);
    (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    credsMock.liq = { publicKey: '', privateKey: '' };
    credsMock.wfp = { merchantAccount: '', secretKey: '' };
  });

  it('apple_pay routes to WayForPay when WFP is configured', async () => {
    credsMock.wfp = { merchantAccount: 'merch', secretKey: 'sec' };
    mockWayforpay.createPayment.mockResolvedValue({
      redirectUrl: 'https://wfp/pay',
      paymentId: 'pid',
    });

    const r = await initiatePayment(1, 'apple_pay');

    expect(mockWayforpay.createPayment).toHaveBeenCalledWith(
      1,
      500,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      { paymentSystems: 'applePay' },
    );
    expect(r.redirectUrl).toBe('https://wfp/pay');
    // payment record should reference wayforpay (not "apple_pay")
    const upsertArg = (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertArg.create.paymentProvider).toBe('wayforpay');
  });

  it('apple_pay falls back to LiqPay when WFP not configured', async () => {
    credsMock.liq = { publicKey: 'pub', privateKey: 'priv' };
    const liqpayMod = liqpay as unknown as { createApplePayPayment: ReturnType<typeof vi.fn> };
    liqpayMod.createApplePayPayment.mockResolvedValue({ redirectUrl: 'https://liq/apay' });

    await initiatePayment(1, 'apple_pay');

    expect(liqpayMod.createApplePayPayment).toHaveBeenCalled();
    const upsertArg = (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertArg.create.paymentProvider).toBe('liqpay');
  });

  it('google_pay routes to WFP with paymentSystems=googlePay', async () => {
    credsMock.wfp = { merchantAccount: 'merch', secretKey: 'sec' };
    mockWayforpay.createPayment.mockResolvedValue({ redirectUrl: 'https://wfp/gp' });

    await initiatePayment(1, 'google_pay');

    expect(mockWayforpay.createPayment).toHaveBeenCalledWith(
      1,
      500,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      { paymentSystems: 'googlePay' },
    );
  });

  it('apple_pay throws when no gateway is configured', async () => {
    await expect(initiatePayment(1, 'apple_pay')).rejects.toThrow('Apple Pay недоступний');
  });

  it('google_pay throws when no gateway is configured', async () => {
    await expect(initiatePayment(1, 'google_pay')).rejects.toThrow('Google Pay недоступний');
  });

  it('liqpay_paypart routes to dedicated function and stores as liqpay', async () => {
    const liqpayMod = liqpay as unknown as { createPaypartPayment: ReturnType<typeof vi.fn> };
    liqpayMod.createPaypartPayment.mockResolvedValue({ redirectUrl: 'https://liq/pp' });

    await initiatePayment(1, 'liqpay_paypart');

    expect(liqpayMod.createPaypartPayment).toHaveBeenCalled();
    const upsertArg = (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertArg.create.paymentProvider).toBe('liqpay');
  });
});
