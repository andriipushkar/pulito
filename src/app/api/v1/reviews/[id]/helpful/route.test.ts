import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));

vi.mock('@/services/review', () => ({
  markReviewHelpful: vi.fn(),
}));

vi.mock('@/utils/api-response', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: (data: any, status = 200) => NextResponse.json({ success: true, data }, { status }),
    errorResponse: (message: string, status = 500) => NextResponse.json({ success: false, error: message }, { status }),
  };
});

import { POST } from './route';
import { markReviewHelpful } from '@/services/review';

const mockMarkHelpful = markReviewHelpful as ReturnType<typeof vi.fn>;

describe('POST /api/v1/reviews/[id]/helpful', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid id', async () => {
    const req = new NextRequest('http://localhost');
    const res = await POST(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('marks review as helpful on success', async () => {
    mockMarkHelpful.mockResolvedValue(undefined);
    const req = new NextRequest('http://localhost');
    const res = await POST(req, { params: Promise.resolve({ id: '5' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    mockMarkHelpful.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost');
    const res = await POST(req, { params: Promise.resolve({ id: '5' }) });
    expect(res.status).toBe(500);
  });
});
