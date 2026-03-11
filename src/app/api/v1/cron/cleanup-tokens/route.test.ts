import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/services/jobs/cleanup-tokens', () => ({ cleanupExpiredTokens: vi.fn() }));

import { POST } from './route';
import { cleanupExpiredTokens } from '@/services/jobs/cleanup-tokens';

describe('POST src/app/api/v1/cron/cleanup-tokens', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns result on success with valid auth', async () => {
    vi.mocked(cleanupExpiredTokens).mockResolvedValue(5);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-app-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(cleanupExpiredTokens).mockRejectedValue(new Error('fail'));
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
