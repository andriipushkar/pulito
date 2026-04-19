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
      handler,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailTemplate: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/email-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns templates on success', async () => {
    (prisma.emailTemplate.findMany as any).mockResolvedValue([{ id: 1, templateKey: 'welcome' }]);

    const res = await (GET as any)();

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (prisma.emailTemplate.findMany as any).mockRejectedValue(new Error('fail'));

    const res = await (GET as any)();

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/email-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates template on success', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue(null);
    (prisma.emailTemplate.create as any).mockResolvedValue({ id: 1, templateKey: 'new' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey: 'new', subject: 'Test', bodyHtml: '<p>Test</p>' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it('returns 400 when required fields missing', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 409 when template key already exists', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({ id: 1, templateKey: 'existing' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey: 'existing', subject: 'Test', bodyHtml: '<p>Test</p>' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it('returns 500 on error', async () => {
    (prisma.emailTemplate.findUnique as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey: 'new', subject: 'Test', bodyHtml: '<p>Test</p>' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
