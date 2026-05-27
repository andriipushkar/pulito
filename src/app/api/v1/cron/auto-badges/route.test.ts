import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
    APP_SECRET: 'test-app-secret',
  },
}));
vi.mock('@/services/badge', () => ({ autoAssignBadges: vi.fn() }));
// Cron-lock wrapper runs the callback inline in tests so we exercise the
// real lock path. Real Redis lock isn't available here.
vi.mock('@/lib/cron-lock', () => ({
  withCronLock: vi.fn((_name: string, _ttl: number, fn: () => unknown) => fn()),
}));

import { POST } from './route';
import { autoAssignBadges } from '@/services/badge';

describe('POST src/app/api/v1/cron/auto-badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns result on success with valid CRON_SECRET', async () => {
    vi.mocked(autoAssignBadges).mockResolvedValue({ newArrivals: 3, hits: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(autoAssignBadges).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
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
