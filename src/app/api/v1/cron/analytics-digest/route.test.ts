import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/analytics-digest', () => ({ sendAnalyticsDigest: vi.fn() }));

import { POST } from './route';
import { sendAnalyticsDigest } from '@/services/jobs/analytics-digest';

describe('POST /api/v1/cron/analytics-digest', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends digest on success', async () => {
    vi.mocked(sendAnalyticsDigest).mockResolvedValue({ sent: true } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: 'daily' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: 'daily' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid period', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: 'yearly' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('defaults to daily period when body parse fails', async () => {
    vi.mocked(sendAnalyticsDigest).mockResolvedValue({ sent: true } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
      body: 'invalid json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(sendAnalyticsDigest)).toHaveBeenCalledWith('daily');
  });

  it('returns 500 on error', async () => {
    vi.mocked(sendAnalyticsDigest).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: 'daily' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
