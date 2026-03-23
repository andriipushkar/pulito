import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/blog', () => ({
  getPostBySlug: vi.fn(),
  getRelatedPosts: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { GET } from './route';
import { getPostBySlug, getRelatedPosts } from '@/services/blog';

const mockGetPost = getPostBySlug as ReturnType<typeof vi.fn>;
const mockGetRelated = getRelatedPosts as ReturnType<typeof vi.fn>;

describe('GET /api/v1/blog/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 if post not found', async () => {
    mockGetPost.mockResolvedValue(null);
    const req = new NextRequest('http://localhost');
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-post' }) });
    expect(res.status).toBe(404);
  });

  it('returns post with related posts', async () => {
    mockGetPost.mockResolvedValue({ id: 1, title: 'Test', slug: 'test' });
    mockGetRelated.mockResolvedValue([{ id: 2, title: 'Related' }]);
    const req = new NextRequest('http://localhost');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.related).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    mockGetPost.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost');
    const res = await GET(req, { params: Promise.resolve({ slug: 'test' }) });
    expect(res.status).toBe(500);
  });
});
