import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/pallet-delivery', () => {
  class PalletDeliveryError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { calculatePalletDeliveryCost: vi.fn(), PalletDeliveryError };
});

vi.mock('@/validators/pallet-delivery', () => ({
  calculatePalletCostSchema: { safeParse: vi.fn() },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { POST } from './route';
import { calculatePalletDeliveryCost } from '@/services/pallet-delivery';
import { calculatePalletCostSchema } from '@/validators/pallet-delivery';

const mockCalculate = calculatePalletDeliveryCost as ReturnType<typeof vi.fn>;
const mockSafeParse = calculatePalletCostSchema.safeParse as ReturnType<typeof vi.fn>;

describe('POST /api/v1/delivery/pallet/calculate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates pallet delivery cost', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { weightKg: 100, region: 'kyiv' } });
    mockCalculate.mockResolvedValue({ cost: 500, currency: 'UAH' });
    const req = new NextRequest('http://localhost/api/v1/delivery/pallet/calculate', {
      method: 'POST',
      body: JSON.stringify({ weightKg: 100, region: 'kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'bad' }] } });
    const req = new NextRequest('http://localhost/api/v1/delivery/pallet/calculate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockSafeParse.mockReturnValue({ success: true, data: { weightKg: 100, region: 'kyiv' } });
    mockCalculate.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/delivery/pallet/calculate', {
      method: 'POST',
      body: JSON.stringify({ weightKg: 100, region: 'kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('uses fallback message when issues array is empty', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [] } });
    const req = new NextRequest('http://localhost/api/v1/delivery/pallet/calculate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Невірні дані');
  });

  it('returns PalletDeliveryError status on PalletDeliveryError', async () => {
    const { PalletDeliveryError } = await import('@/services/pallet-delivery');
    mockSafeParse.mockReturnValue({ success: true, data: { weightKg: 100, region: 'kyiv' } });
    mockCalculate.mockRejectedValue(new PalletDeliveryError('disabled', 400));
    const req = new NextRequest('http://localhost/api/v1/delivery/pallet/calculate', {
      method: 'POST',
      body: JSON.stringify({ weightKg: 100, region: 'kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
