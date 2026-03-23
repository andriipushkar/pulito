import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wholesaleRule: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/wholesale-rules', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns wholesale rules', async () => {
    const rules = [
      { id: 1, ruleType: 'markup', productId: null, product: null, value: 10, isActive: true, createdAt: '2024-01-01' },
    ];
    vi.mocked(prisma.wholesaleRule.findMany).mockResolvedValue(rules as any);

    const req = new Request('http://localhost');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data[0].value).toBe(10);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.wholesaleRule.findMany).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost');
    const res = await GET(req as any);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/wholesale-rules', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a wholesale rule', async () => {
    const rule = { id: 1, ruleType: 'markup', productId: null, product: null, value: 15, isActive: true, createdAt: '2024-01-01' };
    vi.mocked(prisma.wholesaleRule.create).mockResolvedValue(rule as any);

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleType: 'markup', value: 15 }),
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.value).toBe(15);
  });

  it('returns 422 when ruleType or value missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(422);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.wholesaleRule.create).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleType: 'markup', value: 15 }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
  });
});
