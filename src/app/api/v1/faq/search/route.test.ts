import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/faq', () => ({
  searchFaq: vi.fn(),
}));

import { GET } from './route';
import { searchFaq } from '@/services/faq';

const mocked = vi.mocked(searchFaq);

describe('GET /api/v1/faq/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns results on valid query', async () => {
    mocked.mockResolvedValue([{ id: 1 }] as never);
    const req = new NextRequest('http://localhost/api/v1/faq/search?q=test');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 422 on short query', async () => {
    const req = new NextRequest('http://localhost/api/v1/faq/search?q=a');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('returns 422 when q param is missing entirely', async () => {
    const req = new NextRequest('http://localhost/api/v1/faq/search');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/faq/search?q=test');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
