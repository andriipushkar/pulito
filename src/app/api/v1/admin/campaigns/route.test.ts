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
vi.mock('@/services/campaign', () => ({
  getCampaignRules: vi.fn(),
  createCampaignRule: vi.fn(),
  CampaignError: class CampaignError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
}));
vi.mock('@/validators/campaign', () => ({
  createCampaignRuleSchema: { safeParse: vi.fn() },
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { GET, POST } from './route';
import { getCampaignRules, createCampaignRule } from '@/services/campaign';
import { createCampaignRuleSchema } from '@/validators/campaign';

describe('GET /api/v1/admin/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns campaign rules on success', async () => {
    (getCampaignRules as any).mockResolvedValue([{ id: 1, name: 'Rule' }]);

    const req = new NextRequest('http://localhost/api/v1/admin/campaigns');
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    (getCampaignRules as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost/api/v1/admin/campaigns');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates campaign rule on success', async () => {
    (createCampaignRuleSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'New' },
    });
    (createCampaignRule as any).mockResolvedValue({ id: 1, name: 'New' });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it('returns 422 on validation error', async () => {
    (createCampaignRuleSchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    });

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    (createCampaignRuleSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { name: 'X' },
    });
    (createCampaignRule as any).mockRejectedValue(new Error('fail'));

    const req = new NextRequest('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
