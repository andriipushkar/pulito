import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    APP_URL: 'https://test.com',
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars-required-here',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock server-tracking
const mockTrackPurchase = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/server-tracking', () => ({
  trackPurchase: mockTrackPurchase,
}));

import { handlePaymentCallback } from './payment';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
  (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
});

describe('handlePaymentCallback - tracking', () => {
  it('fires server-side tracking on successful payment', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ totalAmount: 500, orderNumber: 'ORD-100', userId: 1 }) // first call for amount validation
      .mockResolvedValueOnce({ // second call for tracking data
        orderNumber: 'ORD-100',
        totalAmount: 500,
        userId: 1,
        contactEmail: 'user@test.com',
        contactPhone: '+380991234567',
        items: [
          { productId: 1, productName: 'Product A', priceAtOrder: 250, quantity: 2 },
        ],
      });
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', {
      orderId: 1,
      status: 'success',
      transactionId: 'tx-100',
      rawData: {},
      amount: 500,
    });

    // Wait for dynamic import to resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(mockTrackPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ORD-100',
        totalAmount: 500,
        email: 'user@test.com',
      })
    );
  });

  it('logs payment confirmation', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ totalAmount: 100, orderNumber: 'ORD-200', userId: 2 })
      .mockResolvedValueOnce({
        orderNumber: 'ORD-200', totalAmount: 100, userId: 2,
        contactEmail: 'a@b.com', contactPhone: '+380991111111',
        items: [],
      });
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('monobank', {
      orderId: 2,
      status: 'success',
      transactionId: 'tx-200',
      rawData: {},
      amount: 100,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Payment confirmed',
      expect.objectContaining({ orderId: 2, provider: 'monobank' })
    );
  });

  it('does not fire tracking on failed payment', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 100, orderNumber: 'ORD-300', userId: 3,
    });
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('wayforpay', {
      orderId: 3,
      status: 'failure',
      transactionId: 'tx-300',
      rawData: {},
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it('logs amount mismatch as warning', async () => {
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalAmount: 500, orderNumber: 'ORD-400', userId: 4,
    });
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await handlePaymentCallback('liqpay', {
      orderId: 4,
      status: 'success',
      transactionId: 'tx-400',
      rawData: {},
      amount: 200,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Payment amount mismatch',
      expect.objectContaining({ paidAmount: 200, expectedAmount: 500 })
    );
  });

  it('ignores duplicate webhooks', async () => {
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue(null); // NX returns null for duplicates

    await handlePaymentCallback('liqpay', {
      orderId: 1,
      status: 'success',
      transactionId: 'tx-dup',
      rawData: {},
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Duplicate webhook ignored',
      expect.objectContaining({ transactionId: 'tx-dup' })
    );
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });
});
