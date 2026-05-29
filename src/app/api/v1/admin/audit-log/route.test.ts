import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/v1/admin/audit-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated audit logs on success', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/audit-log?page=1&limit=20');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('filters by actionType', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/audit-log?actionType=CREATE');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ actionType: 'CREATE' }) }),
    );
  });

  it('filters by userId', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/audit-log?userId=5');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 5 }) }),
    );
  });

  it('filters by dateFrom only', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/audit-log?dateFrom=2024-01-01');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: expect.any(Date) } }),
      }),
    );
  });

  it('filters by dateTo only', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    const req = new Request('http://localhost/api/v1/admin/audit-log?dateTo=2024-12-31');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    // dateTo widens to next-day midnight + uses `lt` so the chosen day is fully inclusive.
    expect(vi.mocked(prisma.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { lt: expect.any(Date) } }),
      }),
    );
  });

  it('filters by both dateFrom and dateTo', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    const req = new Request(
      'http://localhost/api/v1/admin/audit-log?dateFrom=2024-01-01&dateTo=2024-12-31',
    );
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.auditLog.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: expect.any(Date), lt: expect.any(Date) },
        }),
      }),
    );
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost/api/v1/admin/audit-log');
    const res = await GET(req as any);
    expect(res.status).toBe(500);
  });
});
