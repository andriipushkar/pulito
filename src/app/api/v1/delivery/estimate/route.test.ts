import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockEstimateDeliveryCost = vi.hoisted(() => vi.fn());

vi.mock('@/services/nova-poshta', () => {
  class NovaPoshtaError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { estimateDeliveryCost: mockEstimateDeliveryCost, NovaPoshtaError };
});

vi.mock('@/validators/delivery', () => ({
  deliveryEstimateSchema: { safeParse: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), setex: vi.fn() },
  CACHE_TTL: { SHORT: 60 },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { deliveryEstimateSchema } from '@/validators/delivery';
import { redis } from '@/lib/redis';

const mockSafeParse = deliveryEstimateSchema.safeParse as ReturnType<typeof vi.fn>;
const mockRedisGet = redis.get as ReturnType<typeof vi.fn>;
const mockRedisSetex = redis.setex as ReturnType<typeof vi.fn>;

describe('GET /api/v1/delivery/estimate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 on validation error', async () => {
    mockSafeParse.mockReturnValue({ success: false });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns free delivery when total >= freeFrom', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'ref', total: 2000, weight: 1 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=ref&total=2000&weight=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost).toBe(0);
    expect(json.data.estimatedDays).toBe('1-3 дні');
    expect(json.data.freeFrom).toBe(1500);
  });

  it('returns ukrposhta flat rate for weight <= 2', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'ukrposhta', city: null, total: 100, weight: 1 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=ukrposhta&total=100&weight=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost).toBe(45);
    expect(json.data.estimatedDays).toBe('3-7 днів');
  });

  it('returns ukrposhta flat rate for weight <= 10', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'ukrposhta', city: null, total: 100, weight: 5 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=ukrposhta&total=100&weight=5');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(65);
  });

  it('returns ukrposhta flat rate for weight > 10', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'ukrposhta', city: null, total: 100, weight: 15 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=ukrposhta&total=100&weight=15');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(95);
  });

  it('returns null cost when nova_poshta without city', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: null, total: 100, weight: 1 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&total=100&weight=1');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBeNull();
    expect(json.data.estimatedDays).toBeNull();
    expect(json.data.freeFrom).toBe(1500);
  });

  it('returns cached result when available', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'city-ref', total: 100, weight: 2 },
    });
    mockRedisGet.mockResolvedValue(JSON.stringify({ cost: 55, estimatedDays: '2-3 дні' }));
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=city-ref&total=100&weight=2');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(55);
    expect(json.data.estimatedDays).toBe('2-3 дні');
    expect(json.data.freeFrom).toBe(1500);
    expect(mockEstimateDeliveryCost).not.toHaveBeenCalled();
  });

  it('calls nova poshta API and caches result', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'city-ref', total: 100, weight: 2 },
    });
    mockRedisGet.mockResolvedValue(null);
    mockEstimateDeliveryCost.mockResolvedValue({ cost: 70, estimatedDays: '1-2 дні' });
    mockRedisSetex.mockResolvedValue('OK');

    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=city-ref&total=100&weight=2');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(70);
    expect(json.data.estimatedDays).toBe('1-2 дні');
    expect(json.data.freeFrom).toBe(1500);
    expect(mockEstimateDeliveryCost).toHaveBeenCalledWith({
      citySender: '8d5a980d-391c-11dd-90d9-001a92567626',
      cityRecipient: 'city-ref',
      weight: 2,
      serviceType: 'WarehouseWarehouse',
      cost: 100,
    });
    expect(mockRedisSetex).toHaveBeenCalled();
  });

  it('handles redis get error gracefully', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'city-ref', total: 100, weight: 2 },
    });
    mockRedisGet.mockRejectedValue(new Error('Redis down'));
    mockEstimateDeliveryCost.mockResolvedValue({ cost: 70, estimatedDays: '1-2 дні' });
    mockRedisSetex.mockResolvedValue('OK');

    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=city-ref&total=100&weight=2');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost).toBe(70);
  });

  it('handles redis setex error gracefully', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'city-ref', total: 100, weight: 2 },
    });
    mockRedisGet.mockResolvedValue(null);
    mockEstimateDeliveryCost.mockResolvedValue({ cost: 70, estimatedDays: '1-2 дні' });
    mockRedisSetex.mockRejectedValue(new Error('Redis write fail'));

    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=city-ref&total=100&weight=2');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost).toBe(70);
  });

  it('returns NovaPoshtaError with proper status', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'city-ref', total: 100, weight: 2 },
    });
    mockRedisGet.mockResolvedValue(null);

    const { NovaPoshtaError } = await import('@/services/nova-poshta');
    mockEstimateDeliveryCost.mockRejectedValue(new NovaPoshtaError('NP error', 503));

    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=city-ref&total=100&weight=2');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('returns 500 on unknown error', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'city-ref', total: 100, weight: 2 },
    });
    mockRedisGet.mockResolvedValue(null);
    mockEstimateDeliveryCost.mockRejectedValue(new Error('Unknown'));

    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=city-ref&total=100&weight=2');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('returns free delivery when total equals freeFrom exactly', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'nova_poshta', city: 'ref', total: 1500, weight: 1 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=nova_poshta&city=ref&total=1500&weight=1');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(0);
  });

  it('returns ukrposhta flat rate for weight exactly 2', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'ukrposhta', city: null, total: 100, weight: 2 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=ukrposhta&total=100&weight=2');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(45);
  });

  it('returns ukrposhta flat rate for weight exactly 10', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { method: 'ukrposhta', city: null, total: 100, weight: 10 },
    });
    const req = new NextRequest('http://localhost/api/v1/delivery/estimate?method=ukrposhta&total=100&weight=10');
    const res = await GET(req);
    const json = await res.json();
    expect(json.data.cost).toBe(65);
  });
});
