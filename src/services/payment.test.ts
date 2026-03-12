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
  },
}));

vi.mock('@/config/env', () => ({
  env: { APP_URL: 'https://test.com' },
}));

vi.mock('./payment-providers/liqpay', () => ({
  createPayment: vi.fn(),
}));

vi.mock('./payment-providers/monobank', () => ({
  createPayment: vi.fn(),
}));

vi.mock('./payment-providers/wayforpay', () => ({
  createPayment: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import * as liqpay from './payment-providers/liqpay';
import * as monobank from './payment-providers/monobank';
import * as wayforpay from './payment-providers/wayforpay';
import { PaymentError, initiatePayment, handlePaymentCallback, getPaymentStatus } from './payment';

const mockPrisma = prisma as unknown as MockPrismaClient;
const mockLiqpay = liqpay as { createPayment: ReturnType<typeof vi.fn> };
const mockMonobank = monobank as { createPayment: ReturnType<typeof vi.fn> };
const mockWayforpay = wayforpay as { createPayment: ReturnType<typeof vi.fn> };

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
      'https://test.com/api/webhooks/liqpay'
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
      'https://test.com/api/webhooks/monobank'
    );
    expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 1 },
        create: expect.objectContaining({
          paymentProvider: 'monobank',
          transactionId: 'mono-456',
        }),
      })
    );
  });

  it('calls wayforpay.createPayment when provider is wayforpay', async () => {
    (mockPrisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseOrder);
    const paymentResult = { paymentId: 'order_1_1700000000', redirectUrl: 'https://secure.wayforpay.com/invoice/test' };
    mockWayforpay.createPayment.mockResolvedValue(paymentResult);
    (mockPrisma.payment.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await initiatePayment(1, 'wayforpay');

    expect(result).toEqual(paymentResult);
    expect(mockWayforpay.createPayment).toHaveBeenCalledWith(
      1,
      500,
      'Замовлення #ORD-001',
      'https://test.com/checkout/payment-redirect?orderId=1',
      'https://test.com/api/webhooks/wayforpay'
    );
    expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 1 },
        create: expect.objectContaining({
          paymentProvider: 'wayforpay',
          transactionId: 'order_1_1700000000',
        }),
      })
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
      })
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
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', successCallback);

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        amount: 0,
        paymentProvider: 'liqpay',
        transactionId: 'txn-001',
        callbackData: { some: 'data' },
        paidAt: expect.any(Date),
      }),
    });

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        paymentStatus: 'paid',
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: 'paid',
            changeSource: 'system',
            comment: 'Оплата підтверджена через liqpay',
          },
        },
      },
    });
  });

  it('updates existing payment record (success status) and updates order', async () => {
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
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
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', failureCallback);

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: {
        paymentStatus: 'pending',
        transactionId: 'txn-002',
        callbackData: { error: 'declined' },
        paidAt: null,
      },
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('creates payment record on failure when none exists', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('monobank', failureCallback);

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        paymentStatus: 'pending',
        paidAt: null,
      }),
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('creates payment record for wayforpay provider on success', async () => {
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockPrisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockPrisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('wayforpay', successCallback);

    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 1,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        amount: 0,
        paymentProvider: 'wayforpay',
        transactionId: 'txn-001',
        callbackData: { some: 'data' },
        paidAt: expect.any(Date),
      }),
    });

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        paymentStatus: 'paid',
        statusHistory: {
          create: {
            oldStatus: null,
            newStatus: 'paid',
            changeSource: 'system',
            comment: 'Оплата підтверджена через wayforpay',
          },
        },
      },
    });
  });

  it('updates existing payment for wayforpay on failure without updating order', async () => {
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
    (mockPrisma.payment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('wayforpay', failureCallback);

    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 1 },
      data: {
        paymentStatus: 'pending',
        transactionId: 'txn-002',
        callbackData: { error: 'declined' },
        paidAt: null,
      },
    });

    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('handles processing status with existing payment', async () => {
    const existingPayment = {
      orderId: 1,
      paymentStatus: 'pending',
      paidAt: null,
    };
    (mockPrisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(existingPayment);
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
