import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  payment: { findMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const handleCallbackMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/payment', () => ({ handlePaymentCallback: handleCallbackMock }));

const liqMock = vi.hoisted(() => ({ checkPaymentStatus: vi.fn() }));
const monoMock = vi.hoisted(() => ({ checkInvoiceStatus: vi.fn() }));
const wfpMock = vi.hoisted(() => ({ checkTransactionStatus: vi.fn() }));

vi.mock('@/services/payment-providers/liqpay', () => liqMock);
vi.mock('@/services/payment-providers/monobank', () => monoMock);
vi.mock('@/services/payment-providers/wayforpay', () => wfpMock);

import { reconcileStuckPayments } from './payment-reconciliation';

beforeEach(() => {
  vi.clearAllMocks();
});

const stuckPayment = (overrides: Record<string, unknown> = {}) => ({
  orderId: 1,
  paymentProvider: 'liqpay',
  transactionId: 'txn-x',
  amount: 100,
  order: { id: 1, orderNumber: 'ORD-1' },
  ...overrides,
});

describe('reconcileStuckPayments', () => {
  it('returns checked=0 when no stuck payments', async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    const r = await reconcileStuckPayments();
    expect(r).toEqual({ checked: 0, resolved: 0 });
  });

  it('calls handlePaymentCallback when liqpay reports success', async () => {
    prismaMock.payment.findMany.mockResolvedValue([stuckPayment()]);
    liqMock.checkPaymentStatus.mockResolvedValue({ status: 'success', amount: 100 });
    const r = await reconcileStuckPayments();
    expect(r.resolved).toBe(1);
    expect(handleCallbackMock).toHaveBeenCalledWith(
      'liqpay',
      expect.objectContaining({ status: 'success' }),
    );
  });

  it('skips when provider returns processing', async () => {
    prismaMock.payment.findMany.mockResolvedValue([stuckPayment()]);
    liqMock.checkPaymentStatus.mockResolvedValue({ status: 'processing' });
    const r = await reconcileStuckPayments();
    expect(r.resolved).toBe(0);
    expect(handleCallbackMock).not.toHaveBeenCalled();
  });

  it('routes to monobank checkInvoiceStatus', async () => {
    prismaMock.payment.findMany.mockResolvedValue([stuckPayment({ paymentProvider: 'monobank' })]);
    monoMock.checkInvoiceStatus.mockResolvedValue({ status: 'success', amount: 100 });
    await reconcileStuckPayments();
    expect(monoMock.checkInvoiceStatus).toHaveBeenCalledWith('txn-x');
    expect(handleCallbackMock).toHaveBeenCalledWith('monobank', expect.any(Object));
  });

  it('routes to wayforpay checkTransactionStatus', async () => {
    prismaMock.payment.findMany.mockResolvedValue([stuckPayment({ paymentProvider: 'wayforpay' })]);
    wfpMock.checkTransactionStatus.mockResolvedValue({ status: 'failure' });
    await reconcileStuckPayments();
    expect(wfpMock.checkTransactionStatus).toHaveBeenCalledWith('txn-x');
    expect(handleCallbackMock).toHaveBeenCalledWith('wayforpay', expect.any(Object));
  });

  it('survives one provider error and continues to next', async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      stuckPayment({ orderId: 1 }),
      stuckPayment({ orderId: 2, paymentProvider: 'monobank' }),
    ]);
    liqMock.checkPaymentStatus.mockRejectedValue(new Error('boom'));
    monoMock.checkInvoiceStatus.mockResolvedValue({ status: 'success' });
    const r = await reconcileStuckPayments();
    expect(r.resolved).toBe(1);
  });
});
