import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/validators/referral', () => ({ referralFilterSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/referral', () => ({ getAllReferrals: vi.fn() }));

import { GET } from './route';
import { getAllReferrals } from '@/services/referral';
import { referralFilterSchema } from '@/validators/referral';

describe('GET /api/v1/admin/referrals', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns referrals on success', async () => {
    vi.mocked(referralFilterSchema.safeParse).mockReturnValue({ success: true, data: { page: 1, limit: 20 } } as any);
    vi.mocked(getAllReferrals).mockResolvedValue({ items: [], total: 0 });
    const req = new NextRequest('http://localhost/api/v1/admin/referrals');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 on filter validation error', async () => {
    vi.mocked(referralFilterSchema.safeParse).mockReturnValue({ success: false, error: { issues: [{ message: 'bad filter' }] } } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/referrals');
    const res = await GET(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(referralFilterSchema.safeParse).mockReturnValue({ success: true, data: { page: 1, limit: 20 } } as any);
    vi.mocked(getAllReferrals).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/referrals');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
