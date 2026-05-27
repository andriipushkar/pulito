import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
    APP_URL: 'https://test.com',
    CRON_SECRET: 'test-cron-secret',
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    productBadge: { update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/utils/request', () => ({ getClientIp: () => null }));

import { PUT, DELETE } from './route';
import { prisma } from '@/lib/prisma';

const ctx = (idStr: string) => ({ params: Promise.resolve({ id: idStr }), user: { id: 1 } }) as any;
const mockCtx = ctx('1');

describe('PUT /api/v1/admin/badges/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.productBadge.findUnique).mockResolvedValue({
      isLocked: false,
      isActive: true,
      badgeType: 'new_arrival',
      priority: 5,
    } as any);
  });

  it('updates badge on success', async () => {
    vi.mocked(prisma.productBadge.update).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(200);
  });

  it('returns 404 when badge missing', async () => {
    vi.mocked(prisma.productBadge.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.update).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, ctx('abc'));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/admin/badges/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.productBadge.findUnique).mockResolvedValue({
      productId: 1,
      badgeType: 'new_arrival',
      isLocked: false,
    } as any);
  });

  it('deletes badge on success', async () => {
    vi.mocked(prisma.productBadge.delete).mockResolvedValue({} as any);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx);
    expect(res.status).toBe(200);
  });

  it('returns 404 when badge missing', async () => {
    vi.mocked(prisma.productBadge.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx);
    expect(res.status).toBe(404);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.delete).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, mockCtx);
    expect(res.status).toBe(500);
  });

  it('returns 400 for non-numeric id', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, ctx('abc'));
    expect(res.status).toBe(400);
  });
});
