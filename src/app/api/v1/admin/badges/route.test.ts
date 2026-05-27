import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
  withRole:
    (..._roles: string[]) =>
    (handler: Function) =>
    (...args: unknown[]) =>
      handler(...args),
}));
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
    productBadge: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
  },
}));
vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('@/utils/request', () => ({ getClientIp: () => null }));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

const ctx = { user: { id: 1 } } as any;
const validBody = { productId: 1, badgeType: 'new_arrival' };

describe('GET /api/v1/admin/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns badges on success', async () => {
    vi.mocked(prisma.productBadge.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost');
    const res = await (GET as any)(req, ctx);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.findMany).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await (GET as any)(req, ctx);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.productBadge.findUnique).mockResolvedValue(null);
  });

  it('creates badge on success', async () => {
    vi.mocked(prisma.productBadge.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(201);
  });

  it('returns 422 when productId missing', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ badgeType: 'new_arrival' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(422);
  });

  it('returns 422 when badgeType is invalid', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ productId: 1, badgeType: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(422);
  });

  it('returns 422 when customColor is unsafe', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, customColor: '<script>alert(1)' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(422);
  });

  it('returns 404 when product missing', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(404);
  });

  it('returns 409 when badge already exists', async () => {
    vi.mocked(prisma.productBadge.findUnique).mockResolvedValue({ id: 5 } as any);
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(409);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.productBadge.create).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await (POST as any)(req, ctx);
    expect(res.status).toBe(500);
  });
});
