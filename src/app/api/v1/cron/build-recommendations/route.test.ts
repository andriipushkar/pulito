import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/build-collaborative-recs', () => ({ runBuildCollaborativeRecs: vi.fn() }));

import { POST } from './route';
import { runBuildCollaborativeRecs } from '@/services/jobs/build-collaborative-recs';

describe('POST /api/v1/cron/build-recommendations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', { method: 'POST' });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('builds recommendations on success', async () => {
    vi.mocked(runBuildCollaborativeRecs).mockResolvedValue({ created: 100, durationMs: 500 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.created).toBe(100);
    expect(data.data.durationMs).toBe(500);
  });

  it('returns 500 on error', async () => {
    vi.mocked(runBuildCollaborativeRecs).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });
});
