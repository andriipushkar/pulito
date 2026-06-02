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
vi.mock('@/lib/redis', () => ({ redis: { set: vi.fn().mockResolvedValue('OK') } }));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/validators/loyalty', () => ({ adjustPointsSchema: { safeParse: vi.fn() } }));
vi.mock('@/services/loyalty', () => ({
  adjustPoints: vi.fn(),
  LoyaltyError: class LoyaltyError extends Error {
    statusCode = 400;
  },
}));

import { POST } from './route';
import { adjustPoints } from '@/services/loyalty';
import { adjustPointsSchema } from '@/validators/loyalty';

describe('POST /api/v1/admin/loyalty/adjust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adjusts points on success', async () => {
    vi.mocked(adjustPointsSchema.safeParse).mockReturnValue({
      success: true,
      data: { userId: 1, points: 100 },
    } as any);
    vi.mocked(adjustPoints).mockResolvedValue(undefined as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1, points: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(adjustPointsSchema.safeParse).mockReturnValue({
      success: true,
      data: { userId: 1, points: 100 },
    } as any);
    vi.mocked(adjustPoints).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1, points: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation failure', async () => {
    vi.mocked(adjustPointsSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'invalid' }] },
    } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns LoyaltyError status on LoyaltyError', async () => {
    const { LoyaltyError } = await import('@/services/loyalty');
    vi.mocked(adjustPointsSchema.safeParse).mockReturnValue({
      success: true,
      data: { userId: 1, points: 100 },
    } as any);
    vi.mocked(adjustPoints).mockRejectedValue(new (LoyaltyError as any)('insufficient'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 1, points: 100 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
