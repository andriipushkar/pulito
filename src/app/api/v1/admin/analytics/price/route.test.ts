import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/analytics-reports', () => ({ getPriceAnalytics: vi.fn() }));

import { GET } from './route';
import { getPriceAnalytics } from '@/services/analytics-reports';

describe('GET /api/v1/admin/analytics/price', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns price analytics on success', async () => {
    vi.mocked(getPriceAnalytics).mockResolvedValue({ data: [] } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/price?days=30');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getPriceAnalytics).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/price');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
