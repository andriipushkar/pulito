import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/analytics', () => ({ getABCAnalysis: vi.fn() }));

import { GET } from './route';
import { getABCAnalysis } from '@/services/analytics';

describe('GET /api/v1/admin/analytics/abc', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns ABC analysis on success', async () => {
    vi.mocked(getABCAnalysis).mockResolvedValue({ A: [], B: [], C: [] });
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/abc?days=30');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getABCAnalysis).mockRejectedValue(new Error('fail'));
    const req = new NextRequest('http://localhost/api/v1/admin/analytics/abc');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
