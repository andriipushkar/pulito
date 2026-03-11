import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/search-history', () => ({
  saveSearch: vi.fn(),
  getSearchHistory: vi.fn(),
  clearSearchHistory: vi.fn(),
  deleteSearchEntry: vi.fn(),
  getRecentUniqueQueries: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const actual = await vi.importActual('@/utils/api-response');
  return actual;
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST, DELETE } from './route';
import { getSearchHistory, saveSearch, clearSearchHistory, getRecentUniqueQueries } from '@/services/search-history';

const mockGetSearchHistory = getSearchHistory as ReturnType<typeof vi.fn>;
const mockSaveSearch = saveSearch as ReturnType<typeof vi.fn>;
const mockClearHistory = clearSearchHistory as ReturnType<typeof vi.fn>;
const mockGetUniqueQueries = getRecentUniqueQueries as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/search-history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns unique queries when unique=true', async () => {
    mockGetUniqueQueries.mockResolvedValue(['query1', 'query2']);
    const req = new NextRequest('http://localhost/api/v1/me/search-history?unique=true');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns paginated search history', async () => {
    mockGetSearchHistory.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/me/search-history');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockGetSearchHistory.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/search-history');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/me/search-history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves search query', async () => {
    mockSaveSearch.mockResolvedValue({ id: 1, query: 'test' });
    const req = new NextRequest('http://localhost/api/v1/me/search-history', {
      method: 'POST',
      body: JSON.stringify({ query: 'test', resultsCount: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
  });

  it('returns 400 for missing query', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/search-history', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    mockSaveSearch.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/search-history', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/me/search-history', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears search history', async () => {
    mockClearHistory.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost/api/v1/me/search-history', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    mockClearHistory.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/search-history', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('deletes single entry by id', async () => {
    const { deleteSearchEntry } = await import('@/services/search-history');
    vi.mocked(deleteSearchEntry).mockResolvedValue(undefined as any);
    const req = new NextRequest('http://localhost/api/v1/me/search-history?id=5', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/search-history?id=abc', { method: 'DELETE' });
    const res = await DELETE(req, authCtx as any);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/me/search-history - edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for empty trimmed query', async () => {
    const req = new NextRequest('http://localhost/api/v1/me/search-history', {
      method: 'POST',
      body: JSON.stringify({ query: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });
});
