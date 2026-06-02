import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/nova-poshta', () => {
  class NovaPoshtaError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { trackParcel: vi.fn(), NovaPoshtaError };
});

vi.mock('@/services/ukrposhta', () => {
  class UkrposhtaError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { trackParcel: vi.fn(), UkrposhtaError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));

import { GET } from './route';
import { trackParcel as trackNovaPoshta } from '@/services/nova-poshta';
import { trackParcel as trackUkrposhta } from '@/services/ukrposhta';
import { prisma } from '@/lib/prisma';

const mockTrackNP = trackNovaPoshta as ReturnType<typeof vi.fn>;
const mockTrackUP = trackUkrposhta as ReturnType<typeof vi.fn>;
const mockOrderFindUnique = prisma.order.findUnique as ReturnType<typeof vi.fn>;

describe('GET /api/v1/delivery/tracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks nova poshta parcel', async () => {
    mockOrderFindUnique.mockResolvedValue({ trackingNumber: '123', deliveryMethod: 'nova_poshta' });
    mockTrackNP.mockResolvedValue({ status: 'Delivered' });
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta&orderNumber=ORD1',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.provider).toBe('nova_poshta');
  });

  it('tracks ukrposhta parcel', async () => {
    mockOrderFindUnique.mockResolvedValue({ trackingNumber: '456', deliveryMethod: 'ukrposhta' });
    mockTrackUP.mockResolvedValue({ status: 'In transit' });
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=456&provider=ukrposhta&orderNumber=ORD2',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.provider).toBe('ukrposhta');
  });

  it('returns 400 for missing trackingNumber', async () => {
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?provider=nova_poshta&orderNumber=ORD1',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid provider', async () => {
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=dhl&orderNumber=ORD1',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when order/TTN pair does not match', async () => {
    mockOrderFindUnique.mockResolvedValue(null);
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta&orderNumber=NOPE',
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns NovaPoshtaError status code', async () => {
    const { NovaPoshtaError } = await import('@/services/nova-poshta');
    mockOrderFindUnique.mockResolvedValue({ trackingNumber: '123', deliveryMethod: 'nova_poshta' });
    mockTrackNP.mockRejectedValue(new NovaPoshtaError('Not found', 404));
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta&orderNumber=ORD1',
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns UkrposhtaError status code', async () => {
    const { UkrposhtaError } = await import('@/services/ukrposhta');
    mockOrderFindUnique.mockResolvedValue({ trackingNumber: '456', deliveryMethod: 'ukrposhta' });
    mockTrackUP.mockRejectedValue(new UkrposhtaError('Not found', 404));
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=456&provider=ukrposhta&orderNumber=ORD2',
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    mockOrderFindUnique.mockResolvedValue({ trackingNumber: '123', deliveryMethod: 'nova_poshta' });
    mockTrackNP.mockRejectedValue(new Error('fail'));
    const req = new NextRequest(
      'http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta&orderNumber=ORD1',
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
