import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  checkLoginRateLimit: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  clearLoginAttempts: vi.fn().mockResolvedValue(undefined),
  withRateLimit: () => (handler: Function) => handler,
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));

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
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    verify: vi.fn(),
    sendMail: vi.fn(),
  })),
}));

import { POST } from './route';
import * as nodemailer from 'nodemailer';

describe('POST /api/v1/admin/smtp-settings/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on valid SMTP connection', async () => {
    const mockVerify = vi.fn().mockResolvedValue(true);
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      verify: mockVerify,
      sendMail: vi.fn(),
    } as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { host: 'smtp.test.com', port: 587 } }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
  });

  it('sends test email when testEmail provided', async () => {
    const mockSendMail = vi.fn().mockResolvedValue({});
    const mockVerify = vi.fn().mockResolvedValue(true);
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      verify: mockVerify,
      sendMail: mockSendMail,
    } as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { host: 'smtp.test.com', port: 587 },
        testEmail: 'test@example.com',
      }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(json.data.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('returns error when host/port missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(json.data.success).toBe(false);
  });

  it('returns error on connection failure', async () => {
    const mockVerify = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.mocked(nodemailer.createTransport).mockReturnValue({ verify: mockVerify } as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { host: 'smtp.test.com', port: 587 } }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(json.data.success).toBe(false);
    expect(json.data.error).toContain('Connection refused');
  });
});
