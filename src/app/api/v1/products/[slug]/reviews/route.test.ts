import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/review', () => ({
  getProductReviews: vi.fn(),
  getProductRatingStats: vi.fn(),
  createReview: vi.fn(),
}));

vi.mock('@/validators/review', () => ({
  createReviewSchema: { safeParse: vi.fn() },
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST } from './route';
import { getProductReviews, getProductRatingStats, createReview } from '@/services/review';
import { createReviewSchema } from '@/validators/review';

const mockGetProductReviews = getProductReviews as ReturnType<typeof vi.fn>;
const mockGetProductRatingStats = getProductRatingStats as ReturnType<typeof vi.fn>;
const mockCreateReview = createReview as ReturnType<typeof vi.fn>;
const mockCreateReviewParse = createReviewSchema.safeParse as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'client' }, params: Promise.resolve({ slug: '5' }) };

// ---------------------------------------------------------------------------
// GET /api/v1/products/[id]/reviews
// ---------------------------------------------------------------------------

describe('GET /api/v1/products/[id]/reviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns reviews and stats', async () => {
    mockGetProductReviews.mockResolvedValue({
      reviews: [{ id: 1, rating: 5 }],
      total: 1,
    });
    mockGetProductRatingStats.mockResolvedValue({
      averageRating: 5,
      totalReviews: 1,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
    });

    const req = new NextRequest('http://localhost/api/v1/products/5/reviews');
    const res = await GET(req, { params: Promise.resolve({ slug: '5' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.reviews).toHaveLength(1);
    expect(json.data.stats.averageRating).toBe(5);
    expect(json.data.total).toBe(1);
    expect(json.data.page).toBe(1);
    expect(json.data.limit).toBe(10);
  });

  it('passes pagination params', async () => {
    mockGetProductReviews.mockResolvedValue({ reviews: [], total: 0 });
    mockGetProductRatingStats.mockResolvedValue({
      averageRating: 0,
      totalReviews: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });

    const req = new NextRequest('http://localhost/api/v1/products/5/reviews?page=2&limit=5&sort=helpful');
    await GET(req, { params: Promise.resolve({ slug: '5' }) });

    expect(mockGetProductReviews).toHaveBeenCalledWith(5, 2, 5, 'helpful');
  });

  it('returns 400 for invalid product id', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/abc/reviews');
    const res = await GET(req, { params: Promise.resolve({ slug: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockGetProductReviews.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/products/5/reviews');
    const res = await GET(req, { params: Promise.resolve({ slug: '5' }) });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/products/[id]/reviews
// ---------------------------------------------------------------------------

describe('POST /api/v1/products/[id]/reviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates review for authenticated user', async () => {
    mockCreateReviewParse.mockReturnValue({
      success: true,
      data: { productId: 5, rating: 4, title: 'Good', comment: 'Nice product' },
    });
    mockCreateReview.mockResolvedValue({
      id: 1,
      productId: 5,
      userId: 1,
      rating: 4,
      title: 'Good',
      comment: 'Nice product',
      isVerifiedPurchase: false,
    });

    const req = new NextRequest('http://localhost/api/v1/products/5/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 4, title: 'Good', comment: 'Nice product' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.rating).toBe(4);
    expect(mockCreateReview).toHaveBeenCalledWith({
      productId: 5,
      rating: 4,
      title: 'Good',
      comment: 'Nice product',
      userId: 1,
    });
  });

  it('returns 422 on validation errors', async () => {
    mockCreateReviewParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Rating must be between 1 and 5' }] },
    });

    const req = new NextRequest('http://localhost/api/v1/products/5/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 0 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(422);
  });

  it('returns 409 on duplicate review (P2002)', async () => {
    mockCreateReviewParse.mockReturnValue({
      success: true,
      data: { productId: 5, rating: 5 },
    });
    const prismaError = new Error('Unique constraint failed');
    (prismaError as any).code = 'P2002';
    mockCreateReview.mockRejectedValue(prismaError);

    const req = new NextRequest('http://localhost/api/v1/products/5/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid product id', async () => {
    const req = new NextRequest('http://localhost/api/v1/products/abc/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {
      user: { id: 1, email: 'test@test.com', role: 'client' },
      params: Promise.resolve({ slug: 'abc' }),
    } as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on server error', async () => {
    mockCreateReviewParse.mockReturnValue({
      success: true,
      data: { productId: 5, rating: 5 },
    });
    mockCreateReview.mockRejectedValue(new Error('DB down'));

    const req = new NextRequest('http://localhost/api/v1/products/5/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
