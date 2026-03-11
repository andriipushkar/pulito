import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/recently-viewed', () => ({
  getRecentlyViewed: vi.fn(),
  addRecentlyViewed: vi.fn(),
  clearRecentlyViewed: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST, DELETE } from './route';
import { getRecentlyViewed, addRecentlyViewed, clearRecentlyViewed } from '@/services/recently-viewed';

const mockGetRecentlyViewed = getRecentlyViewed as ReturnType<typeof vi.fn>;
const mockAddRecentlyViewed = addRecentlyViewed as ReturnType<typeof vi.fn>;
const mockClearRecentlyViewed = clearRecentlyViewed as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/recently-viewed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns recently viewed items', async () => {
    mockGetRecentlyViewed.mockResolvedValue([{ id: 1 }]);
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockGetRecentlyViewed.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/recently-viewed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds product to recently viewed', async () => {
    mockAddRecentlyViewed.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing productId', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockAddRecentlyViewed.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed', {
      method: 'POST',
      body: JSON.stringify({ productId: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/me/recently-viewed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears recently viewed', async () => {
    mockClearRecentlyViewed.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockClearRecentlyViewed.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/recently-viewed', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
