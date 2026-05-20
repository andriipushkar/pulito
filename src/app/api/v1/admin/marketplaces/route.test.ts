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
vi.mock('@/middleware/auth', () => ({
  withRole: (..._roles: string[]) => (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 'test-admin', email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/services/marketplace-sync', () => ({
  getConnectionStatus: vi.fn(),
}));
vi.mock('@/services/marketplace-health', () => ({
  MARKETPLACE_PLATFORMS: ['rozetka', 'prom'] as const,
  getAllHealthStatuses: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/services/marketplace-rate-limit', () => ({
  getAllRateUsage: vi.fn().mockReturnValue({}),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET } from './route';
import { getConnectionStatus } from '@/services/marketplace-sync';

describe('GET /api/v1/admin/marketplaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns marketplace connections on success', async () => {
    (getConnectionStatus as any).mockResolvedValue({ platform: 'rozetka', connected: true });

    const res = await (GET as any)();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
  });

  it('returns 500 on error', async () => {
    // getConnectionStatus rejections are swallowed per-platform; make the
    // outer call fail by rejecting getAllHealthStatuses instead.
    const { getAllHealthStatuses } = await import('@/services/marketplace-health');
    vi.mocked(getAllHealthStatuses).mockRejectedValueOnce(new Error('fail'));

    const res = await (GET as any)();

    expect(res.status).toBe(500);
  });
});
