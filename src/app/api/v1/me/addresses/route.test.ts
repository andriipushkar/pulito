import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/delivery-address', () => ({
  getUserAddresses: vi.fn(),
  createAddress: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST } from './route';
import { getUserAddresses, createAddress } from '@/services/delivery-address';

const mockGetUserAddresses = getUserAddresses as ReturnType<typeof vi.fn>;
const mockCreateAddress = createAddress as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/addresses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user addresses', async () => {
    mockGetUserAddresses.mockResolvedValue([{ id: 1, city: 'Kyiv' }]);
    const req = new NextRequest('http://localhost/api/v1/me/addresses');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockGetUserAddresses.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/addresses');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/addresses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates address', async () => {
    mockCreateAddress.mockResolvedValue({ id: 1, city: 'Kyiv' });
    const req = new NextRequest('http://localhost/api/v1/me/addresses', {
      method: 'POST',
      body: JSON.stringify({ city: 'Kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 for missing city', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/addresses', {
      method: 'POST',
      body: JSON.stringify({ city: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mockCreateAddress.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/addresses', {
      method: 'POST',
      body: JSON.stringify({ city: 'Kyiv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
