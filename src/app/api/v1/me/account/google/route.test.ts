import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { DELETE, GET } from './route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/account/google', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns google link status', async () => {
    mockFindUnique.mockResolvedValue({ googleId: 'g1', passwordHash: 'hash' });
    const req = new NextRequest('http://localhost/api/v1/me/account/google');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.hasGoogle).toBe(true);
    expect(json.data.hasPassword).toBe(true);
  });

  it('returns 404 when user not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/me/account/google');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on server error', async () => {
    mockFindUnique.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/account/google');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/me/account/google', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unlinks google account', async () => {
    mockFindUnique.mockResolvedValue({ googleId: 'g1', passwordHash: 'hash' });
    mockUpdate.mockResolvedValue({});
    const req = new NextRequest('http://localhost/api/v1/me/account/google', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when google not connected', async () => {
    mockFindUnique.mockResolvedValue({ googleId: null, passwordHash: 'hash' });
    const req = new NextRequest('http://localhost/api/v1/me/account/google', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when no password set', async () => {
    mockFindUnique.mockResolvedValue({ googleId: 'g1', passwordHash: null });
    const req = new NextRequest('http://localhost/api/v1/me/account/google', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/me/account/google', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on server error', async () => {
    mockFindUnique.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/account/google', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
