import { NextRequest } from 'next/server';
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
  withRole:
    (..._roles: string[]) =>
    (handler: any) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, { user: { id: 1, email: 'admin@test.com', role: 'admin' }, ...(ctx || {}) }),
}));
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailTemplate: { findUnique: vi.fn() },
  },
}));
vi.mock('@/services/email', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('POST /api/v1/admin/email-templates/[id]/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends test email on success', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({
      id: 1,
      subject: 'Test Subject',
      bodyHtml: '<p>Hello {{name}}</p>',
    });
    (sendEmail as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req, makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sent).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when template not found', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req, makeParams('999'));

    expect(res.status).toBe(404);
  });

  it('returns 400 when email is missing', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({
      id: 1,
      subject: 'S',
      bodyHtml: '<p>H</p>',
    });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({
      id: 1,
      subject: 'S',
      bodyHtml: '<p>H</p>',
    });
    (sendEmail as any).mockRejectedValue(new Error('SMTP error'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
