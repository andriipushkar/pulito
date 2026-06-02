import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productNote: { findMany: vi.fn(), upsert: vi.fn() },
    product: { findUnique: vi.fn() },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

const mockFindMany = prisma.productNote.findMany as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.productNote.upsert as ReturnType<typeof vi.fn>;
const mockProductFindUnique = prisma.product.findUnique as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns notes', async () => {
    mockFindMany.mockResolvedValue([{ id: 1, noteText: 'test' }]);
    const req = new NextRequest('http://localhost/api/v1/me/notes');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockFindMany.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/notes');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a note', async () => {
    mockProductFindUnique.mockResolvedValue({ id: 1 });
    mockUpsert.mockResolvedValue({ id: 1, noteText: 'note' });
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, noteText: 'note' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 422 for missing fields', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 422 for note exceeding max length', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, noteText: 'a'.repeat(2001) }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 404 when product does not exist', async () => {
    mockProductFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 999, noteText: 'note' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 500 on server error', async () => {
    mockProductFindUnique.mockResolvedValue({ id: 1 });
    mockUpsert.mockRejectedValue(new Error('db fail'));
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, noteText: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
