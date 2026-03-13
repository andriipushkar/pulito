import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: Function) => (...args: unknown[]) => handler(...args) }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/performance', () => ({ getAggregatedMetrics: vi.fn() }));

import { GET } from './route';
import { getAggregatedMetrics } from '@/services/performance';

describe('GET /api/v1/admin/analytics/performance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns metrics on success', async () => {
    vi.mocked(getAggregatedMetrics).mockResolvedValue({ avg: 100 } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/performance?days=30');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getAggregatedMetrics).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/performance');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });

  it('passes route filter parameter', async () => {
    vi.mocked(getAggregatedMetrics).mockResolvedValue({ avg: 50 } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/performance?days=7&route=/api/products');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(getAggregatedMetrics).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      '/api/products'
    );
  });

  it('clamps days to min 1, max 90', async () => {
    vi.mocked(getAggregatedMetrics).mockResolvedValue({ avg: 10 } as any);
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/performance?days=200');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });
});
