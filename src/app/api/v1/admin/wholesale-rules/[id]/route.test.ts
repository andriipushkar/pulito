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
    (handler: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      handler(req, {
        user: { id: 'test-admin', email: 'admin@test.com', role: 'admin' },
        ...(ctx || {}),
      }),
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wholesaleRule: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const before = { ruleType: 'min_order_amount', productId: null, value: 10, isActive: true };
const rule = {
  id: 1,
  ruleType: 'min_order_amount',
  productId: null,
  product: null,
  value: 20,
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-02-01T00:00:00.000Z',
};

describe('PUT /api/v1/admin/wholesale-rules/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a wholesale rule (no token → plain update)', async () => {
    vi.mocked(prisma.wholesaleRule.findUnique).mockResolvedValue(before as any);
    vi.mocked(prisma.wholesaleRule.update).mockResolvedValue({} as any);
    vi.mocked(prisma.wholesaleRule.findUniqueOrThrow).mockResolvedValue(rule as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.value).toBe(20);
    expect(prisma.wholesaleRule.updateMany).not.toHaveBeenCalled();
  });

  it('updates with matching token → 200 via atomic updateMany', async () => {
    vi.mocked(prisma.wholesaleRule.findUnique).mockResolvedValue(before as any);
    vi.mocked(prisma.wholesaleRule.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.wholesaleRule.findUniqueOrThrow).mockResolvedValue(rule as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20, expectedUpdatedAt: '2024-02-01T00:00:00.000Z' }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(200);
    expect(prisma.wholesaleRule.update).not.toHaveBeenCalled();
  });

  it('returns 409 when token is stale (concurrent edit)', async () => {
    vi.mocked(prisma.wholesaleRule.findUnique).mockResolvedValue(before as any);
    vi.mocked(prisma.wholesaleRule.updateMany).mockResolvedValue({ count: 0 } as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20, expectedUpdatedAt: '2024-01-01T00:00:00.000Z' }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(409);
  });

  it('returns 404 when rule not found', async () => {
    vi.mocked(prisma.wholesaleRule.findUnique).mockResolvedValue(null as any);

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.wholesaleRule.findUnique).mockResolvedValue(before as any);
    vi.mocked(prisma.wholesaleRule.update).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 20 }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/wholesale-rules/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a wholesale rule', async () => {
    vi.mocked(prisma.wholesaleRule.delete).mockResolvedValue({} as any);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.wholesaleRule.delete).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
