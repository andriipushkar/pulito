import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/publish-scheduled', () => ({ publishScheduledPublications: vi.fn() }));

import { POST } from './route';
import { publishScheduledPublications } from '@/services/jobs/publish-scheduled';

describe('POST src/app/api/v1/cron/publications', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns result on success with valid auth', async () => {
    vi.mocked(publishScheduledPublications).mockResolvedValue({ published: 2, failed: 0 });
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(publishScheduledPublications).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 401 without valid authorization', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
