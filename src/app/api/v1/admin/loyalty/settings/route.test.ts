import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 'test-admin', role: 'admin' }, ...(ctx || {}) }),
}));
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
vi.mock('@/services/loyalty', () => ({
  getLoyaltyLevels: vi.fn(),
  updateLoyaltySettings: vi.fn(),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));

import { GET, PUT } from './route';
import { getLoyaltyLevels, updateLoyaltySettings } from '@/services/loyalty';

describe('GET /api/v1/admin/loyalty/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loyalty levels on success', async () => {
    vi.mocked(getLoyaltyLevels).mockResolvedValue([]);
    const res = await (GET as any)();
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getLoyaltyLevels).mockRejectedValue(new Error('fail'));
    const res = await (GET as any)();
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/loyalty/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validLevels = [
    { name: 'Bronze', minSpent: 0, pointsMultiplier: 1, discountPercent: 0, sortOrder: 0 },
  ];

  it('updates loyalty settings on success', async () => {
    vi.mocked(getLoyaltyLevels).mockResolvedValue([]);
    vi.mocked(updateLoyaltySettings).mockResolvedValue([]);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ levels: validLevels }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 422 when levels is not an array', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ levels: 'not-array' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    vi.mocked(getLoyaltyLevels).mockResolvedValue([]);
    vi.mocked(updateLoyaltySettings).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ levels: validLevels }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(500);
  });
});
