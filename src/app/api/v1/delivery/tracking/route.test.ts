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

import { GET } from './route';
import { trackParcel as trackNovaPoshta } from '@/services/nova-poshta';
import { trackParcel as trackUkrposhta } from '@/services/ukrposhta';

const mockTrackNP = trackNovaPoshta as ReturnType<typeof vi.fn>;
const mockTrackUP = trackUkrposhta as ReturnType<typeof vi.fn>;

describe('GET /api/v1/delivery/tracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tracks nova poshta parcel', async () => {
    mockTrackNP.mockResolvedValue({ status: 'Delivered' });
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.provider).toBe('nova_poshta');
  });

  it('tracks ukrposhta parcel', async () => {
    mockTrackUP.mockResolvedValue({ status: 'In transit' });
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?trackingNumber=456&provider=ukrposhta');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.provider).toBe('ukrposhta');
  });

  it('returns 400 for missing trackingNumber', async () => {
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?provider=nova_poshta');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid provider', async () => {
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=dhl');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns NovaPoshtaError status code', async () => {
    const { NovaPoshtaError } = await import('@/services/nova-poshta');
    mockTrackNP.mockRejectedValue(new NovaPoshtaError('Not found', 404));
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns UkrposhtaError status code', async () => {
    const { UkrposhtaError } = await import('@/services/ukrposhta');
    mockTrackUP.mockRejectedValue(new UkrposhtaError('Not found', 404));
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?trackingNumber=456&provider=ukrposhta');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    mockTrackNP.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/delivery/tracking?trackingNumber=123&provider=nova_poshta');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
