import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) => (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 'test-admin', email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/services/jobs/broken-link-checker', () => ({ checkBrokenLinks: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

import { GET } from './route';
import { checkBrokenLinks } from '@/services/jobs/broken-link-checker';

describe('GET /api/v1/admin/seo/broken-links', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns broken links report on success', async () => {
    vi.mocked(checkBrokenLinks).mockResolvedValue({ broken: [] } as any);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkBrokenLinks).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});
