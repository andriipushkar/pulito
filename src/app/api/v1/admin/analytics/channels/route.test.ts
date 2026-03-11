import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/analytics-reports', () => ({ getChannelAnalytics: vi.fn() }));

import { GET } from './route';
import { getChannelAnalytics } from '@/services/analytics-reports';

describe('GET /api/v1/admin/analytics/channels', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns channel analytics on success', async () => {
    vi.mocked(getChannelAnalytics).mockResolvedValue({ channels: [] });
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/channels?days=30');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getChannelAnalytics).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/channels');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
