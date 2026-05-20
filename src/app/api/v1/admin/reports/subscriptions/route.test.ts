import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
   
  withRole: () => (handler: any) => (req: any) =>
    handler(req, { user: { id: 42, email: 'owner@pulito.trade', role: 'admin' } }),
}));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    APP_URL: 'https://test.com',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    reportTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

describe('admin/reports/subscriptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET returns only the current admin\'s active subscriptions', async () => {
    vi.mocked(prisma.reportTemplate.findMany).mockResolvedValue([
      {
        id: 1,
        reportType: 'sales_summary',
        schedule: 'daily',
        scheduleEmail: 'owner@pulito.trade',
        createdAt: new Date(),
      },
       
    ] as any);
     
    const res = await GET(new Request('http://localhost/x') as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(prisma.reportTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdBy: 42, isActive: true } }),
    );
  });

  it('POST creates a new subscription with explicit email', async () => {
    vi.mocked(prisma.reportTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.reportTemplate.create).mockResolvedValue({
      id: 11,
      reportType: 'sales_summary',
      schedule: 'daily',
      scheduleEmail: 'boss@x.com',
       
    } as any);
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({
        reportType: 'sales_summary',
        schedule: 'daily',
        email: 'boss@x.com',
      }),
    });
     
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    expect(prisma.reportTemplate.create).toHaveBeenCalled();
  });

  it('POST falls back to user\'s login email when none is supplied', async () => {
    vi.mocked(prisma.reportTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'owner@pulito.trade',
       
    } as any);
    vi.mocked(prisma.reportTemplate.create).mockResolvedValue({
      id: 12,
      reportType: 'sales_summary',
      schedule: 'weekly',
       
    } as any);
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ reportType: 'sales_summary', schedule: 'weekly' }),
    });
     
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    expect(prisma.reportTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scheduleEmail: 'owner@pulito.trade' }),
      }),
    );
  });

  it('POST updates email instead of duplicating when subscription exists', async () => {
    vi.mocked(prisma.reportTemplate.findFirst).mockResolvedValue({
      id: 7,
       
    } as any);
    vi.mocked(prisma.reportTemplate.update).mockResolvedValue({
      id: 7,
       
    } as any);
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({
        reportType: 'sales_summary',
        schedule: 'daily',
        email: 'new@x.com',
      }),
    });
     
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(prisma.reportTemplate.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { scheduleEmail: 'new@x.com' },
    });
    expect(prisma.reportTemplate.create).not.toHaveBeenCalled();
  });

  it('POST rejects invalid report type', async () => {
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ reportType: 'invalid', schedule: 'daily' }),
    });
     
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });
});
