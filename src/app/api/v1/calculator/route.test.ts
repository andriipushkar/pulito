import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/calculator', () => ({
  calculateNeeds: vi.fn(),
  calculateRoomNeeds: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET, POST } from './route';
import { calculateNeeds, calculateRoomNeeds } from '@/services/calculator';

const mockCalcNeeds = calculateNeeds as ReturnType<typeof vi.fn>;
const mockCalcRoom = calculateRoomNeeds as ReturnType<typeof vi.fn>;

describe('GET /api/v1/calculator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns calculation result', async () => {
    mockCalcNeeds.mockResolvedValue({ products: [{ name: 'Soap', amount: 2 }] });
    const req = new NextRequest('http://localhost/api/v1/calculator?familySize=4&washLoadsPerWeek=5');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.products).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockCalcNeeds.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/calculator');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/calculator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for empty rooms', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns calculation for rooms', async () => {
    mockCalcRoom.mockResolvedValue({ totalProducts: 5 });
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: [{ type: 'kitchen', area: 20, count: 1 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockCalcRoom.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: [{ type: 'kitchen', area: 20, count: 1 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
