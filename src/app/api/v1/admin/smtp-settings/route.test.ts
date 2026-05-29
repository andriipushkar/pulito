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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/smtp-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SMTP settings with masked password', async () => {
    vi.mocked(prisma.siteSetting.findMany).mockResolvedValue([
      { key: 'smtp_host', value: 'smtp.example.com' },
      { key: 'smtp_pass', value: 'my-secret-password' },
    ] as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.smtp_host).toBe('smtp.example.com');
    expect(json.data.smtp_pass).toContain('••••••');
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.siteSetting.findMany).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req as any);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/smtp-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves SMTP settings', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockResolvedValue({} as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp_host: 'smtp.example.com' }),
    });
    const res = await PUT(req as any, { user: { id: 1 } } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.saved).toBe(true);
  });

  it('skips masked password values', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockResolvedValue({} as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp_pass: 'my-••••••ord' }),
    });
    const res = await PUT(req as any, { user: { id: 1 } } as any);

    expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.siteSetting.upsert).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp_host: 'smtp.example.com' }),
    });
    const res = await PUT(req as any, { user: { id: 1 } } as any);

    expect(res.status).toBe(500);
  });
});
