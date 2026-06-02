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
  withAuth: (handler: Function) => handler,
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
      handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/services/totp', () => ({
  verifyTOTP: vi.fn(),
  decryptStoredSecret: vi.fn((s: string) => s),
}));

vi.mock('@/services/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/two-factor-notify', () => ({
  notifyTwoFactorChange: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { verifyTOTP } from '@/services/totp';

const mockUser = { id: 1, email: 'test@test.com', role: 'admin' };

function createReq(body: any) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/auth/2fa/disable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redis.incr).mockResolvedValue(1);
    vi.mocked(redis.expire).mockResolvedValue(1 as any);
  });

  it('returns 422 for missing code', async () => {
    const res = await POST(createReq({}) as any, { user: mockUser } as any);
    expect(res.status).toBe(422);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(redis.incr).mockResolvedValue(6);
    const res = await POST(createReq({ code: '123456' }) as any, { user: mockUser } as any);
    expect(res.status).toBe(429);
  });

  it('returns 404 if user not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(createReq({ code: '123456' }) as any, { user: mockUser } as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 if 2FA not enabled', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabled: false,
      twoFactorSecret: null,
    } as any);
    const res = await POST(createReq({ code: '123456' }) as any, { user: mockUser } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 if code is invalid', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabled: true,
      twoFactorSecret: 'sec',
    } as any);
    vi.mocked(verifyTOTP).mockReturnValue(false);
    const res = await POST(createReq({ code: '123456' }) as any, { user: mockUser } as any);
    expect(res.status).toBe(400);
  });

  it('disables 2FA on valid code', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      twoFactorEnabled: true,
      twoFactorSecret: 'sec',
    } as any);
    vi.mocked(verifyTOTP).mockReturnValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(redis.del).mockResolvedValue(1 as any);
    const res = await POST(createReq({ code: '123456' }) as any, { user: mockUser } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.twoFactorEnabled).toBe(false);
  });

  it('returns 500 on error', async () => {
    vi.mocked(redis.incr).mockRejectedValue(new Error('fail'));
    const res = await POST(createReq({ code: '123456' }) as any, { user: mockUser } as any);
    expect(res.status).toBe(500);
  });
});
