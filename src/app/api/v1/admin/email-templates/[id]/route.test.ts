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
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailTemplate: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    emailTemplateVersion: { create: vi.fn() },
    campaignRule: { count: vi.fn().mockResolvedValue(0) },
  },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/v1/admin/email-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns template on success', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({ id: 1, templateKey: 'welcome' });

    const req = new NextRequest('http://localhost');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost');
    const res = await GET(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost');
    const res = await GET(req, makeParams('999'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.emailTemplate.findUnique as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/email-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates template on success', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({
      id: 1,
      version: 1,
      subject: 'Old',
      bodyHtml: '<p>Old</p>',
    });
    (prisma.emailTemplateVersion.create as any).mockResolvedValue({});
    (prisma.emailTemplate.update as any).mockResolvedValue({ id: 1, subject: 'New', version: 2 });

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'New' }),
    });
    const res = await PUT(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'New' }),
    });
    const res = await PUT(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'New' }),
    });
    const res = await PUT(req, makeParams('999'));

    expect(res.status).toBe(404);
  });

  it('returns 400 when no data to update', async () => {
    (prisma.emailTemplate.findUnique as any).mockResolvedValue({ id: 1, version: 1 });

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PUT(req, makeParams('1'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (prisma.emailTemplate.findUnique as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'New' }),
    });
    const res = await PUT(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/email-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes template on success', async () => {
    (prisma.emailTemplate.delete as any).mockResolvedValue({});

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (prisma.emailTemplate.delete as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
