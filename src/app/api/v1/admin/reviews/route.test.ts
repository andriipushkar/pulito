import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/review', () => ({ getReviewsForModeration: vi.fn() }));

import { GET } from './route';
import { getReviewsForModeration } from '@/services/review';

const mockGetReviews = vi.mocked(getReviewsForModeration);

describe('GET /api/v1/admin/reviews', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns reviews for moderation', async () => {
    const data = { reviews: [{ id: 1, rating: 5 }], total: 1 };
    mockGetReviews.mockResolvedValue(data as any);

    const req = new Request('http://localhost/api/v1/admin/reviews?page=1&limit=20');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.reviews).toEqual([{ id: 1, rating: 5 }]);
  });

  it('passes status filter', async () => {
    mockGetReviews.mockResolvedValue({ reviews: [], total: 0 } as any);

    const req = new Request('http://localhost/api/v1/admin/reviews?status=pending');
    const res = await GET(req as any);

    expect(mockGetReviews).toHaveBeenCalledWith(1, 20, 'pending');
  });

  it('returns 500 on error', async () => {
    mockGetReviews.mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost/api/v1/admin/reviews');
    const res = await GET(req as any);

    expect(res.status).toBe(500);
  });
});
