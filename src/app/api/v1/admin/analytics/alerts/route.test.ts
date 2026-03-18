import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyticsAlert: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

const mockUser = { id: 1 };

describe('GET /api/v1/admin/analytics/alerts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns alerts on success', async () => {
    vi.mocked(prisma.analyticsAlert.findMany).mockResolvedValue([]);
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts');
    const res = await GET(req as any, { user: mockUser } as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.analyticsAlert.findMany).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts');
    const res = await GET(req as any, { user: mockUser } as any);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/analytics/alerts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates alert on success', async () => {
    vi.mocked(prisma.analyticsAlert.create).mockResolvedValue({ id: 1 } as any);
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts', {
      method: 'POST',
      body: JSON.stringify({ metric: 'daily_revenue', condition: 'above', threshold: 100, channel: 'email' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: mockUser } as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.analyticsAlert.create).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts', {
      method: 'POST',
      body: JSON.stringify({ metric: 'daily_revenue', condition: 'above', threshold: 100, channel: 'email' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: mockUser } as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 on validation error', async () => {
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts', {
      method: 'POST',
      body: JSON.stringify({ metric: 'invalid', condition: 'above', threshold: 100, channel: 'email' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any, { user: mockUser } as any);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/admin/analytics/alerts (mapping)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('maps alert conditions correctly', async () => {
    vi.mocked(prisma.analyticsAlert.findMany).mockResolvedValue([
      { id: 1, alertType: 'daily_revenue', condition: { metric: 'daily_revenue', condition: 'above', threshold: 100 }, notificationChannels: 'email', isActive: true, createdAt: new Date() },
    ] as any);
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts');
    const res = await GET(req as any, { user: mockUser } as any);
    const json = await res.json();
    expect(json.data[0].metric).toBe('daily_revenue');
    expect(json.data[0].threshold).toBe(100);
  });

  it('handles empty condition fields with fallbacks', async () => {
    vi.mocked(prisma.analyticsAlert.findMany).mockResolvedValue([
      { id: 2, alertType: 'stock_zero', condition: {}, notificationChannels: 'telegram', isActive: false, createdAt: new Date() },
    ] as any);
    const req = new Request('http://localhost/api/v1/admin/analytics/alerts');
    const res = await GET(req as any, { user: mockUser } as any);
    const json = await res.json();
    expect(json.data[0].metric).toBe('stock_zero');
    expect(json.data[0].condition).toBe('below');
    expect(json.data[0].threshold).toBe(0);
  });
});
