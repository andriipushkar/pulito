import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/referral', () => {
  class ReferralError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { getUserReferralStats: vi.fn(), ReferralError };
});

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getUserReferralStats } from '@/services/referral';

const mockGetStats = getUserReferralStats as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/referral', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns referral stats', async () => {
    mockGetStats.mockResolvedValue({ code: 'REF123', referrals: 5 });
    const req = new NextRequest('http://localhost/api/v1/me/referral');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on server error', async () => {
    mockGetStats.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/referral');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns ReferralError status on ReferralError', async () => {
    const { ReferralError } = await import('@/services/referral');
    mockGetStats.mockRejectedValue(new ReferralError('no code', 404));
    const req = new NextRequest('http://localhost/api/v1/me/referral');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});
