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
    campaignRule: { findUnique: vi.fn() },
  },
}));
vi.mock('@/services/campaign', () => ({
  updateCampaignRule: vi.fn(),
  deleteCampaignRule: vi.fn(),
  CampaignError: class CampaignError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
}));
vi.mock('@/validators/campaign', () => ({
  updateCampaignRuleSchema: { safeParse: vi.fn() },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, PATCH, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { updateCampaignRule, deleteCampaignRule } from '@/services/campaign';
import { updateCampaignRuleSchema } from '@/validators/campaign';

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/v1/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns campaign rule on success', async () => {
    (prisma.campaignRule.findUnique as any).mockResolvedValue({ id: 1, name: 'Rule' });

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
    (prisma.campaignRule.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost');
    const res = await GET(req, makeParams('999'));

    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    (prisma.campaignRule.findUnique as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost');
    const res = await GET(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/v1/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates campaign rule on success', async () => {
    (updateCampaignRuleSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'Updated' },
    });
    (updateCampaignRule as any).mockResolvedValue({ id: 1, name: 'Updated' });

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (updateCampaignRuleSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'X' },
    });
    (updateCampaignRule as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes campaign rule on success', async () => {
    (deleteCampaignRule as any).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('abc'));

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    (deleteCampaignRule as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('1'));

    expect(res.status).toBe(500);
  });
});
