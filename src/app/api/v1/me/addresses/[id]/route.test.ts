import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/delivery-address', () => {
  class AddressError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { updateAddress: vi.fn(), deleteAddress: vi.fn(), AddressError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { PUT, DELETE } from './route';
import { updateAddress, deleteAddress } from '@/services/delivery-address';

const mockUpdateAddress = updateAddress as ReturnType<typeof vi.fn>;
const mockDeleteAddress = deleteAddress as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: '5' }) };

describe('PUT /api/v1/me/addresses/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates address', async () => {
    mockUpdateAddress.mockResolvedValue({ id: 5, city: 'Lviv' });
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', {
      method: 'PUT',
      body: JSON.stringify({ city: 'Lviv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/addresses/abc', {
      method: 'PUT',
      body: JSON.stringify({ city: 'Lviv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await PUT(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockUpdateAddress.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', {
      method: 'PUT',
      body: JSON.stringify({ city: 'Lviv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/me/addresses/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes address', async () => {
    mockDeleteAddress.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/addresses/abc', { method: 'DELETE' });
    const ctx = { user: { id: 1, email: 'test@test.com', role: 'admin' }, params: Promise.resolve({ id: 'abc' }) };
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockDeleteAddress.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns AddressError status on AddressError', async () => {
    const { AddressError } = await import('@/services/delivery-address');
    mockDeleteAddress.mockRejectedValue(new AddressError('not found', 404));
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/me/addresses/[id] - edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns AddressError status on AddressError', async () => {
    const { AddressError } = await import('@/services/delivery-address');
    mockUpdateAddress.mockRejectedValue(new AddressError('forbidden', 403));
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', {
      method: 'PUT',
      body: JSON.stringify({ city: 'Lviv' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(403);
  });

  it('returns 422 on validation failure', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/addresses/5', {
      method: 'PUT',
      body: JSON.stringify({ label: 'a'.repeat(51) }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, authCtx as any);
    expect(res.status).toBe(422);
  });
});
