import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/product', () => ({
  searchAutocomplete: vi.fn(),
}));

import { GET } from './route';
import { searchAutocomplete } from '@/services/product';

const mockedSearch = vi.mocked(searchAutocomplete);

describe('GET /api/v1/products/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns results on valid query', async () => {
    mockedSearch.mockResolvedValue([{ id: 1, name: 'Test' }] as never);
    const req = new NextRequest('http://localhost/api/v1/products/search?q=test');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 422 on short query', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/search?q=a');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('returns 500 on service error', async () => {
    mockedSearch.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/search?q=test');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('returns 422 when q param is missing (defaults to empty string)', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/search');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });
});
