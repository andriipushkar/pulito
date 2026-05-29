import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => {
  const withUser = (_req: unknown, ctx?: Record<string, unknown>) => ({
    user: { id: 1, email: 'admin@test.com', role: 'admin' },
    ...(ctx || {}),
  });
  const roleWrap =
    (..._roles: unknown[]) =>
    (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, withUser(req, ctx));
  const authWrap = (handler: Function) => (req: unknown, ctx?: Record<string, unknown>) =>
    handler(req, withUser(req, ctx));
  return {
    withRole: roleWrap,
    withRole2fa: roleWrap,
    withAuth: authWrap,
    withOptionalAuth: authWrap,
  };
});
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
  },
}));
vi.mock('@/services/analytics-reports', () => ({ getCustomerSegmentation: vi.fn() }));

import { GET } from './route';
import { getCustomerSegmentation } from '@/services/analytics-reports';

describe('GET /api/v1/admin/analytics/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns segments on success', async () => {
    vi.mocked(getCustomerSegmentation).mockResolvedValue({ segments: [] } as any);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getCustomerSegmentation).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});
