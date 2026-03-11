import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dashboardSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { GET, PUT } from './route';
import { prisma } from '@/lib/prisma';

const mockCtx = { user: { id: 1 } };

describe('GET /api/v1/admin/dashboard/settings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns defaults when no settings exist', async () => {
    vi.mocked(prisma.dashboardSettings.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.lowStockThreshold).toBe(10);
  });

  it('returns saved settings when they exist', async () => {
    vi.mocked(prisma.dashboardSettings.findUnique).mockResolvedValue({ lowStockThreshold: 5 } as any);
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.lowStockThreshold).toBe(5);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.dashboardSettings.findUnique).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost');
    const res = await GET(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/dashboard/settings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates settings on success', async () => {
    vi.mocked(prisma.dashboardSettings.upsert).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ lowStockThreshold: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 on validation error', async () => {
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ lowStockThreshold: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.dashboardSettings.upsert).mockRejectedValue(new Error('fail'));
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ lowStockThreshold: 5 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('updates with layout and refreshIntervalSeconds', async () => {
    vi.mocked(prisma.dashboardSettings.upsert).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ layout: { widgetOrder: ['stats'], hiddenWidgets: [] }, refreshIntervalSeconds: 30 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('updates with no optional fields', async () => {
    vi.mocked(prisma.dashboardSettings.upsert).mockResolvedValue({} as any);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });
});
