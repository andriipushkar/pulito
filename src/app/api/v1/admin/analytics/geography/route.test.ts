import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/analytics-reports', () => ({ getGeographyAnalytics: vi.fn() }));

import { GET } from './route';
import { getGeographyAnalytics } from '@/services/analytics-reports';

describe('GET /api/v1/admin/analytics/geography', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns geography data on success', async () => {
    vi.mocked(getGeographyAnalytics).mockResolvedValue({ regions: [] });
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/geography?days=30');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getGeographyAnalytics).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/geography');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
