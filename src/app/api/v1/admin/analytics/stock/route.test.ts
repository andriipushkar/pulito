import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/analytics-reports', () => ({ getStockAnalytics: vi.fn() }));

import { GET } from './route';
import { getStockAnalytics } from '@/services/analytics-reports';

describe('GET /api/v1/admin/analytics/stock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns stock analytics on success', async () => {
    vi.mocked(getStockAnalytics).mockResolvedValue({ data: [] } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/stock?days=30');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getStockAnalytics).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/stock');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
