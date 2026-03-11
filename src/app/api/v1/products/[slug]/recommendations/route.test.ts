import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/recommendation', () => ({
  getRecommendations: vi.fn(),
}));

import { GET } from './route';
import { getRecommendations } from '@/services/recommendation';

const mocked = vi.mocked(getRecommendations);

describe('GET /api/v1/products/[slug]/recommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns recommendations on success', async () => {
    mocked.mockResolvedValue([{ id: 2 }] as never);
    const req = new NextRequest('http://localhost/api/v1/products/1/recommendations');
    const res = await GET(req, { params: Promise.resolve({ slug: '1' }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 400 on invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/abc/recommendations');
    const res = await GET(req, { params: Promise.resolve({ slug: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 500 on service error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/1/recommendations');
    const res = await GET(req, { params: Promise.resolve({ slug: '1' }) });
    expect(res.status).toBe(500);
  });
});
