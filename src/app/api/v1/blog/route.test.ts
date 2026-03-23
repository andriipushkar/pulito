import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/blog', () => ({
  getPublishedPosts: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
    paginatedResponse: (data: any, total: number, page: number, limit: number) =>
      NextResponse.json({ success: true, data, meta: { total, page, limit } }),
    parseSearchParams: (sp: URLSearchParams) => ({
      page: Number(sp.get('page')) || 1,
      limit: Math.min(Number(sp.get('limit')) || 20, 100),
    }),
  };
});

import { GET } from './route';
import { getPublishedPosts } from '@/services/blog';

const mockGetPosts = getPublishedPosts as ReturnType<typeof vi.fn>;

describe('GET /api/v1/blog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated blog posts', async () => {
    mockGetPosts.mockResolvedValue({ posts: [{ id: 1, title: 'Test' }], total: 1 });
    const req = new NextRequest('http://localhost/api/v1/blog?page=1&limit=10');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });

  it('passes category and tag params', async () => {
    mockGetPosts.mockResolvedValue({ posts: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/blog?category=tips&tag=cleaning');
    await GET(req);
    expect(mockGetPosts).toHaveBeenCalledWith(1, expect.any(Number), 'tips', 'cleaning');
  });

  it('returns 500 on error', async () => {
    mockGetPosts.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/blog');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
