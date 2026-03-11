import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/category', () => ({
  getCategoryBySlug: vi.fn(),
}));

import { GET } from './route';
import { getCategoryBySlug } from '@/services/category';

const mocked = vi.mocked(getCategoryBySlug);

describe('GET /api/v1/categories/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns category on success', async () => {
    mocked.mockResolvedValue({ id: 1, name: 'Cat1' } as never);
    const req = new NextRequest('http://localhost/api/v1/categories/cat1');
    const res = await GET(req, { params: Promise.resolve({ slug: 'cat1' }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('returns 404 when not found', async () => {
    mocked.mockResolvedValue(null as never);
    const req = new NextRequest('http://localhost/api/v1/categories/missing');
    const res = await GET(req, { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 500 on service error', async () => {
    mocked.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/categories/err');
    const res = await GET(req, { params: Promise.resolve({ slug: 'err' }) });
    expect(res.status).toBe(500);
  });
});
