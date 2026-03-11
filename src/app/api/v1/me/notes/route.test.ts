import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productNote: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

const mockFindMany = prisma.productNote.findMany as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.productNote.upsert as ReturnType<typeof vi.fn>;
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
    mockUpsert.mockResolvedValue({ id: 1, noteText: 'note' });
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, noteText: 'note' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 for missing fields', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for note exceeding 500 chars', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/notes', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, noteText: 'a'.repeat(501) }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
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
