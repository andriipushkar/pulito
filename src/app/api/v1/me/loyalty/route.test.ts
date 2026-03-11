import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/loyalty', () => ({
  getLoyaltyDashboard: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET } from './route';
import { getLoyaltyDashboard } from '@/services/loyalty';

const mockGetLoyaltyDashboard = getLoyaltyDashboard as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'admin' } };

describe('GET /api/v1/me/loyalty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns loyalty dashboard', async () => {
    mockGetLoyaltyDashboard.mockResolvedValue({ points: 100, tier: 'silver' });
    const req = new NextRequest('http://localhost/api/v1/me/loyalty');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.points).toBe(100);
  });

  it('returns 500 on error', async () => {
    mockGetLoyaltyDashboard.mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/me/loyalty');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(500);
  });
});
