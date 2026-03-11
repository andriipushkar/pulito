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
  return { searchCities: vi.fn(), NovaPoshtaError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { searchCities } from '@/services/nova-poshta';

const mockSearchCities = searchCities as ReturnType<typeof vi.fn>;

describe('GET /api/v1/delivery/cities', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cities for valid query', async () => {
    mockSearchCities.mockResolvedValue([{ name: 'Kyiv', ref: 'abc' }]);
    const req = new NextRequest('http://localhost/api/v1/delivery/cities?q=Kyiv');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].name).toBe('Kyiv');
  });

  it('returns 400 for short query', async () => {
    const req = new NextRequest('http://localhost/api/v1/delivery/cities?q=K');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing query', async () => {
    const req = new NextRequest('http://localhost/api/v1/delivery/cities');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns NovaPoshtaError status code', async () => {
    const { NovaPoshtaError } = await import('@/services/nova-poshta');
    mockSearchCities.mockRejectedValue(new NovaPoshtaError('API error', 503));
    const req = new NextRequest('http://localhost/api/v1/delivery/cities?q=Kyiv');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('returns 500 on error', async () => {
    mockSearchCities.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/delivery/cities?q=Kyiv');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
